const AttendanceModel = require('../model/attendance.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const factory = require('./handlerFactory');
const moment = require('moment');
const cron = require('node-cron');
const Email = require('../utills/email');
const employedLeaveModel = require('../model/employeePaidLeave.model');
const leavesModel = require('../model/leaves.model');
const Shift = require('../model/shift.model');
const User = require('../model/admin.model');
const HolidaysModel = require('../model/holidays.model');

// Calculate total hours

//--------------------------------- For Management -------------------------//

exports.getTodayAllEmployeeAttendance = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();
  const page = parseInt(req.query.page) || 1; // Current page number, default is 1
  const limit = parseInt(req.query.limit) || 10; // Number of records per page, default is 10
  const employeeName = req.query.employeeName || '';

  try {
    const query = {
      date: currentDate,
      employeeName: { $regex: employeeName, $options: 'i' },
    };

    const totalRecords = await AttendanceModel.countDocuments(query);

    const attendanceRecords = await AttendanceModel.find(query)
      .populate('employeeId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit) // Skip records based on current page and limit
      .limit(limit); // Limit the number of records per page

    res.status(200).json({
      attendanceRecords,
      page: page,
      totalCount: Math.ceil(totalRecords / limit),
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving attendance records', 401));
  }
});

exports.getAllEmployeeAttendance = catchAsync(async (req, res, next) => {
  const { startDate, endDate, employeeName } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};

  if (startDate && endDate) {
    query.date = {
      $gte: moment(startDate).startOf('day').toDate(),
      $lte: moment(endDate).endOf('day').toDate(),
    };
  }

  if (employeeName) {
    query.employeeName = { $regex: employeeName, $options: 'i' };
  }

  try {
    const [attendanceRecords, totalRecords] = await Promise.all([
      AttendanceModel.find(query)
        .sort({ createdAt: -1 })
        .populate('employeeId')
        .skip(skip)
        .limit(limit),
      AttendanceModel.countDocuments(query),
    ]);

    res.status(200).json({
      attendanceRecords,
      page,
      limit,
      totalCount: totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving attendance records', 401));
  }
});

exports.exportAttendance = catchAsync(async (req, res, next) => {
  const { startDate, endDate, employeeName } = req.query;

  const query = {};

  if (startDate && endDate) {
    query.date = {
      $gte: moment(startDate).startOf('day').toDate(),
      $lte: moment(endDate).endOf('day').toDate(),
    };
  }

  if (employeeName) {
    query.employeeName = { $regex: employeeName, $options: 'i' };
  }

  try {
    const attendanceRecords = await AttendanceModel.find(query)
      .sort({ createdAt: 1 })
      .populate('employeeId');

    res.status(200).json({
      attendanceRecords,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving attendance records', 401));
  }
});

exports.getAttendanceByID = catchAsync(async (req, res, next) => {
  const employeeId = req.params.id;

  console.log(`Employee ID ${employeeId}`);
  

  const startOfMonth = moment().startOf('month').startOf('day').toDate();
  const endOfMonth = moment().endOf('month').endOf('day').toDate();

  try {
    // Fetch all attendance records for this employee in the current month
    const attendanceRecords = await AttendanceModel.find({
      employeeId: employeeId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    // Map dates where attendance is recorded
    const attendanceByDate = {};
    attendanceRecords.forEach((record) => {
      const dateKey = moment(record.date).format('YYYY-MM-DD');
      attendanceByDate[dateKey] = record.status; // 'present' or 'absent'
    });

    // Calculate all working days of the month (excluding Saturdays and Sundays)
    const totalWorkingDays = [];
    let current = moment(startOfMonth);
    while (current <= moment(endOfMonth)) {
      const day = current.day(); // Sunday = 0, Saturday = 6
      if (day !== 0 && day !== 6) {
        totalWorkingDays.push(current.format('YYYY-MM-DD'));
      }
      current = current.add(1, 'day');
    }

    // Count present and absent days (only on working days)
    let presentCount = 0;
    let absentCount = 0;

    totalWorkingDays.forEach((date) => {
      if (attendanceByDate[date] === 'present') {
        presentCount++;
      } else {
        absentCount++;
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        employeeId,
        totalWorkingDays: totalWorkingDays.length,
        present: presentCount,
        absent: absentCount,
      },
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error fetching employee attendance', 500));
  }
});

exports.updateAttendanceById = catchAsync(async (req, res, next) => {
  const attendanceId = req.params.id;
  const { checkInTime, checkOutTime, status } = req.body;

  try {
    const attendance = await AttendanceModel.findById(attendanceId);

    if (!attendance) {
      return next(new AppError('Attendance record not found', 404));
    }

    // Update check-in and status
    if (checkInTime) attendance.checkInTime = new Date(checkInTime);
    if (status) {
      attendance.status = status;
      attendance.leaveStatus = status === 'present'
        ? 'working'
        : status === 'halfDay'
        ? 'halfDay'
        : 'absent';
    }

    // Update check-out & recalculate total hours
    if (checkOutTime) {
      attendance.checkOutTime = new Date(checkOutTime);

      const { hours, minutes } = calculateTotalHours(
        attendance.checkInTime,
        attendance.checkOutTime
      );

      const adjustedMinutes = hours * 60 + minutes - (attendance.totalPausedMinutes || 0);
      const finalHours = Math.floor(adjustedMinutes / 60);
      const finalMinutes = adjustedMinutes % 60;

      attendance.totalHours = `${finalHours}h:${finalMinutes} mins`;
      attendance.totalMinutes = adjustedMinutes;

      if (attendance.leaveStatus !== 'absent') {
        attendance.leaveStatus = status === 'halfDay' ? 'halfDay' : 'out of working';
      }
    }

    await attendance.save();

    res.status(200).json({
      status: 'success',
      message: 'Attendance updated successfully',
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error updating attendance record', 500));
  }
});

exports.getEmployeeStats = catchAsync(async (req, res, next) => {
  const employeeId = req.params.id;
  
  if (!employeeId) {
    return next(new AppError('Employee ID is required', 400));
  }

  try {
    // Get current date
    const currentDate = moment().startOf('day');
    
    // Calculate date 30 days ago for averages
    const thirtyDaysAgo = moment().subtract(30, 'days').startOf('day');
    
    // Calculate date 10 days ago for recent attendance
    const tenDaysAgo = moment().subtract(10, 'days').startOf('day');

    // Fetch attendance records for the last 30 days (for averages)
    const attendanceRecords = await AttendanceModel.find({
      employeeId: employeeId,
      date: { $gte: thirtyDaysAgo.toDate(), $lte: currentDate.toDate() },
      status: 'present' // Only consider days when employee was present
    }).sort({ date: -1 });

    // Fetch last 10 days attendance records
    const recentAttendance = await AttendanceModel.find({
      employeeId: employeeId,
      date: { $gte: tenDaysAgo.toDate(), $lte: currentDate.toDate() }
    }).sort({ date: -1 });

    // Calculate statistics
    let totalWorkingMinutes = 0;
    let totalBreakMinutes = 0;
    let checkInTimes = [];
    let checkOutTimes = [];
    let validRecordsCount = 0;

    attendanceRecords.forEach(record => {
      // Only include records with both check-in and check-out times
      if (record.checkInTime && record.checkOutTime) {
        validRecordsCount++;
        
        // Add check-in and check-out times to arrays for averaging
        checkInTimes.push(moment(record.checkInTime));
        checkOutTimes.push(moment(record.checkOutTime));
        
        // Add total working minutes
        totalWorkingMinutes += record.totalMinutes || 0;
        
        // Add break minutes (lunch + break)
        const breakMins = (record.lunchMinutes || 0) + (record.breakMinutes || 0);
        totalBreakMinutes += breakMins;
      }
    });

    // Calculate averages
    const avgWorkingMinutes = validRecordsCount > 0 ? totalWorkingMinutes / validRecordsCount : 0;
    const avgBreakMinutes = validRecordsCount > 0 ? totalBreakMinutes / validRecordsCount : 0;
    
    // Calculate average check-in and check-out times
    let avgCheckInTime = null;
    let avgCheckOutTime = null;
    
    if (checkInTimes.length > 0) {
      // Convert all times to minutes since midnight for averaging
      const checkInMinutes = checkInTimes.map(time => time.hours() * 60 + time.minutes());
      const avgCheckInMinutes = checkInMinutes.reduce((sum, mins) => sum + mins, 0) / checkInMinutes.length;
      
      // Convert back to time format
      const hours = Math.floor(avgCheckInMinutes / 60);
      const minutes = Math.round(avgCheckInMinutes % 60);
      avgCheckInTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    if (checkOutTimes.length > 0) {
      // Convert all times to minutes since midnight for averaging
      const checkOutMinutes = checkOutTimes.map(time => time.hours() * 60 + time.minutes());
      const avgCheckOutMinutes = checkOutMinutes.reduce((sum, mins) => sum + mins, 0) / checkOutMinutes.length;
      
      // Convert back to time format
      const hours = Math.floor(avgCheckOutMinutes / 60);
      const minutes = Math.round(avgCheckOutMinutes % 60);
      avgCheckOutTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Format average working hours
    const avgWorkingHours = Math.floor(avgWorkingMinutes / 60);
    const avgWorkingMins = Math.round(avgWorkingMinutes % 60);
    
    // Prepare response
    const response = {
      employeeId,
      statistics: {
        averageWorkingHours: `${avgWorkingHours}h:${avgWorkingMins} mins`,
        averageWorkingMinutes: avgWorkingMinutes,
        averageCheckInTime: avgCheckInTime,
        averageCheckOutTime: avgCheckOutTime,
        averageBreakTime: `${Math.floor(avgBreakMinutes / 60)}h:${Math.round(avgBreakMinutes % 60)} mins`,
        averageBreakMinutes: avgBreakMinutes,
        daysAnalyzed: validRecordsCount
      },
      recentAttendance: recentAttendance.map(record => ({
        date: moment(record.date).format('YYYY-MM-DD'),
        status: record.status,
        checkInTime: record.checkInTime ? moment(record.checkInTime).format('HH:mm:ss') : null,
        checkOutTime: record.checkOutTime ? moment(record.checkOutTime).format('HH:mm:ss') : null,
        totalHours: record.totalHours,
        breakTime: `${Math.floor((record.lunchMinutes || 0 + record.breakMinutes || 0) / 60)}h:${Math.round((record.lunchMinutes || 0 + record.breakMinutes || 0) % 60)} mins`,
      }))
    };

    res.status(200).json({
      status: 'success',
      data: response
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error calculating employee statistics', 500));
  }
});







// exports.getAllEmployeeAttendance = catchAsync(async (req, res, next) => {
//   const { startDate, endDate, employeeName } = req.query;
//   const page = parseInt(req.query.page) || 1; // Current page number, default is 1
//   const limit = parseInt(req.query.limit) || 200; // Number of records per page, default is 10

//   const query = {};

//   if (startDate && endDate) {
//     query.date = {
//       $gte: moment(startDate).startOf('day').toDate(),
//       $lte: moment(endDate).endOf('day').toDate(),
//     };
//   }

//   if (employeeName) {
//     query.employeeName = { $regex: employeeName, $options: 'i' };
//   }

//   try {
//     const totalRecords = await AttendanceModel.countDocuments(query);

//     const attendanceRecords = await AttendanceModel.find(query)
//       .sort({ createdAt: -1 })
//       .populate('employeeId')
//       .skip((page - 1) * limit) // Skip records based on current page and limit
//       .limit(limit); // Limit the number of records per page

//     res.status(200).json({
//       attendanceRecords,
//       currentPage: page,
//       totalCount: Math.ceil(totalRecords / limit),
//     });
//   } catch (err) {
//     console.error(err);
//     return next(new AppError('Error retrieving attendance records', 401));
//   }
// });

//--------------------------------- END -----------------------------------//

//--------------------------------- For Employee -------------------------//

function calculateTotalHours(checkInTime, checkOutTime) {
  const diff = moment(checkOutTime).diff(moment(checkInTime));
  const duration = moment.duration(diff);

  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();

  return {
    hours,
    minutes,
  };
}

// exports.checkIn = catchAsync(async (req, res, next) => {
//   const currentDate = moment().startOf('day').toDate();
//   const checkInTime = new Date();
//   try {
//     // Check if there is an existing attendance record for the current day
//     const existingEmployee = await Employee.findOne({
//       _id: req.user._id,
//     });

//     if (!existingEmployee) {
//       return next(new AppError('Data not found!', 401));
//     }
//     const existingAttendance = await AttendanceModel.findOne({
//       employeeId: req.user._id,
//       date: currentDate,
//     });

//     if (existingAttendance) {
//       return next(
//         new AppError('Attendance record already exists for today', 401)
//       );
//     }

//     // Employee Shift
//     const shiftId = existingEmployee.shifts;

//     const shift = await Shift.findOne({ _id: shiftId });

//     // Create a new attendance record
//     const attendance = new AttendanceModel({
//       employeeId: req.user._id,
//       employeeName: existingEmployee.name,
//       date: currentDate,
//       checkInTime,
//       totalHours: 0,
//       status: 'present',
//       leaveStatus: 'working', // Mark the employee as present by default
//       shiftId: shift ? shift._id : null,
//       shiftStartTime: shift ? shift.startTime : null,
//       shiftEndTime: shift ? shift.endTime : null,
//       shiftLunchTime: shift ? shift.lunchTime : 0,
//       shiftBreakTime: shift ? shift.breakTime : 0,
//     });

//     await attendance.save();

//     res.status(200).json(attendance);
//   } catch (err) {
//     console.error(err);
//     return next(new AppError('Error saving attendance record', 401));
//   }
// });

exports.checkIn = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();
  const checkInTime = new Date();

  try {
    const existingEmployee = await Employee.findOne({ _id: req.user._id });

    // console.log(`Employee ID ${existingEmployee}`);

    if (!existingEmployee) {
      return next(new AppError('Employee data not found!', 401));
    }

    const existingAttendance = await AttendanceModel.findOne({
      employeeId: req.user._id,
      date: currentDate,
      status : 'absent',
    });
    
    console.log(`Attendance ${existingAttendance}`)
    
    if (existingAttendance) {
      return next(
        new AppError('Attendance record already exists for today', 401)
      );
    }

    const shiftId = existingEmployee.shifts;
    const shift = await Shift.findOne({ _id: shiftId });

    if (!shift) {
      return next(new AppError('Shift data not found!', 401));
    }

    const shiftStartTime = moment(shift.startTime, 'HH:mm');
    const lateThreshold = shiftStartTime.clone().add(2, 'hours');

    if (moment(checkInTime).isAfter(lateThreshold)) {
      const attendance = new AttendanceModel({
        employeeId: req.user._id,
        employeeName: existingEmployee.name,
        date: currentDate,
        checkInTime,
        totalHours: 0,
        status: 'absent',
        leaveStatus: 'absent',
        shiftId: shift ? shift._id : null,
        shiftStartTime: shift ? shift.startTime : null,
        shiftEndTime: shift ? shift.endTime : null,
        shiftLunchTime: shift ? shift.lunchTime : 0,
        shiftBreakTime: shift ? shift.breakTime : 0,
      });

      await attendance.save();

      // Send Email To Employee
      new Email(existingEmployee, '').sendLateCheckInEmail();

      return res
        .status(200)
        .json({ message: 'Marked as absent due to late check-in', attendance });
    }

    // Otherwise, mark as present
    const attendance = new AttendanceModel({
      employeeId: req.user._id,
      employeeName: existingEmployee.name,
      date: currentDate,
      checkInTime,
      totalHours: 0,
      status: 'present',
      leaveStatus: 'working',
      shiftId: shift ? shift._id : null,
      shiftStartTime: shift ? shift.startTime : null,
      shiftEndTime: shift ? shift.endTime : null,
      shiftLunchTime: shift ? shift.lunchTime : 0,
      shiftBreakTime: shift ? shift.breakTime : 0,
    });

    await attendance.save();

    res.status(200).json(attendance);
  } catch (err) {
    console.error(err);
    return next(new AppError('Error saving attendance record', 401));
  }
});

//
// exports.checkOut = catchAsync(async (req, res, next) => {
//   const currentDate = moment().startOf('day').toDate();
//   try {
//     const attendance = await AttendanceModel.findOne({
//       employeeId: req.user._id,
//       date: currentDate,
//       leaveStatus: 'working',
//     });

//     if (!attendance) {
//       return next(new AppError('No attendance record found for today', 401));
//     }

//     if (attendance.checkOutTime) {
//       return next(
//         new AppError('Attendance record already has a check-out time', 401)
//       );
//     }

//     const checkOutTime = new Date();
//     attendance.checkOutTime = checkOutTime;

//     const { hours, minutes } = calculateTotalHours(
//       attendance.checkInTime,
//       checkOutTime
//     );

//     attendance.totalHours = `${hours}h:${minutes} mins`;
//     attendance.leaveStatus = 'out of working';

//     await attendance.save();

//     const formattedTime = moment()
//       .set({ hours, minutes })
//       .format('HH[h]:mm[min]');

//     res.status(200).json({ attendance, formattedTime });
//   } catch (err) {
//     console.error(err);
//     return next(new AppError('Error updating attendance record', 401));
//   }
// });

exports.checkOut = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();
  try {

    console.log('working');
    

    const attendance = await AttendanceModel.findOne({
      employeeId: req.user._id,
      date: currentDate,
    });

    if (!attendance) {
      return next(new AppError('No attendance record found for today', 401));
    }

    if (attendance.checkOutTime) {
      return next(
        new AppError('Attendance record already has a check-out time', 401)
      );
    }

    const checkOutTime = new Date();
    attendance.checkOutTime = checkOutTime;

    // const { hours, minutes } = calculateTotalHours(
    //   attendance.checkInTime,
    //   checkOutTime
    // );

    // attendance.totalHours = `${hours}h:${minutes} mins`;
    // attendance.leaveStatus = 'out of working';

    // await attendance.save();

    if (attendance.lunchStart && !attendance.lunchEnd) {
      let lunchMinutes = (checkOutTime - attendance.lunchStart) / 60000;
      attendance.lunchMinutes += Math.round(lunchMinutes);
      attendance.lunchEnd = checkOutTime;
    }

    if (attendance.breakStart && !attendance.breakEnd) {
      let breakMinutes = (checkOutTime - attendance.breakStart) / 60000;
      attendance.breakMinutes += Math.round(breakMinutes);
      attendance.breakEnd = checkOutTime;
    }

    const { hours, minutes } = calculateTotalHours(
      attendance.checkInTime,
      checkOutTime
    );
    const adjustedMinutes =
      hours * 60 + minutes - attendance.totalPausedMinutes;

    const finalHours = Math.floor(adjustedMinutes / 60);
    const finalMinutes = adjustedMinutes % 60;

    // Only update leaveStatus if it is NOT already marked as absent
    if (attendance.leaveStatus !== 'absent') {
      attendance.leaveStatus = 'out of working';
    }

    attendance.totalHours = `${finalHours}h:${finalMinutes} mins`;

    attendance.totalMinutes = adjustedMinutes;

    await attendance.save();

    const formattedTime = moment()
      .set({ hours, minutes })
      .format('HH[h]:mm[min]');

    res.status(200).json({ attendance, formattedTime });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error updating attendance record', 401));
  }
});


// Helper Function to calculate total hours


// CheckOut Employees Function Cron Job
exports.autoCheckOutEmployees = async () => {
  // Time Zone is set to IST (Kolkata)

  // Time according to IST (Kolkata) for 11:55 is ('55 23 * * *')

  cron.schedule('55 23 * * *', async () => {
    try {
      const currentDate = moment().startOf('day').toDate()
      const currentTime = new Date();

      // Find all attendance records where check-in exists but check-out is missing
      const attendances = await AttendanceModel.find({
        date: currentDate,
        checkInTime: { $ne: null },
        checkOutTime: { $eq: null },
      });

      console.log(`Auto Checkout Cron Running: Found ${attendances.length} employees to checkout.`);

      for (const attendance of attendances) {
        attendance.checkOutTime = currentTime;

        // Handle lunch or break still active
        if (attendance.lunchStart && !attendance.lunchEnd) {
          let lunchMinutes = (currentTime - attendance.lunchStart) / 60000;
          attendance.lunchMinutes += Math.round(lunchMinutes);
          attendance.lunchEnd = currentTime;
        }

        if (attendance.breakStart && !attendance.breakEnd) {
          let breakMinutes = (currentTime - attendance.breakStart) / 60000;
          attendance.breakMinutes += Math.round(breakMinutes);
          attendance.breakEnd = currentTime;
        }

        const { hours, minutes } = calculateTotalHours(
          attendance.checkInTime,
          currentTime
        );

        const adjustedMinutes =
          hours * 60 + minutes - (attendance.totalPausedMinutes || 0);

        const finalHours = Math.floor(adjustedMinutes / 60);
        const finalMinutes = adjustedMinutes % 60;

        attendance.totalHours = null;
        attendance.totalMinutes = null;
        
        // Only update leaveStatus if it is not 'absent'
        if (attendance.leaveStatus !== 'absent') {
          attendance.leaveStatus = 'out of working';
        }

        await attendance.save();
      }

      console.log(`Auto Checkout Cron Completed.`);

    } catch (err) {
      console.error('Error in Auto Checkout Cron:', err);
    }
  }, { timezone : 'Asia/Kolkata' });
};



exports.pauseTracker = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();

  const attendance = await AttendanceModel.findOne({
    employeeId: req.user._id,
    date: currentDate,
  });

  if (!attendance) {
    return next(new AppError('No attendance record found for today', 401));
  }

  // Prevent multiple pauses without resuming
  if (attendance.isPaused) {
    return next(
      new AppError(
        'Tracker is already paused. Resume before pausing again.',
        401
      )
    );
  }

  attendance.pauses.push({ pauseTime: new Date() });
  attendance.isPaused = true; // Mark as paused
  await attendance.save();

  res.status(200).json({ message: 'Tracker paused successfully', attendance });
});

exports.resumeTracker = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();

  const attendance = await AttendanceModel.findOne({
    employeeId: req.user._id,
    date: currentDate,
  });

  if (!attendance) {
    return next(new AppError('No attendance record found for today', 401));
  }

  // Ensure there is a pause entry without a resumeTime
  const lastPause = attendance.pauses[attendance.pauses.length - 1];
  if (!lastPause || lastPause.resumeTime) {
    return next(new AppError('No active pause found to resume.', 401));
  }

  lastPause.resumeTime = new Date();
  attendance.isPaused = false; // Mark as resumed

  // Calculate total paused time in minutes
  const pauseDuration = Math.floor(
    (lastPause.resumeTime - lastPause.pauseTime) / 60000
  ); // Convert ms to minutes

  // Only update totalPausedMinutes if at least 1 minute has passed
  if (pauseDuration >= 1) {
    attendance.totalPausedMinutes += pauseDuration;
  }

  await attendance.save();

  res.status(200).json({
    message: 'Tracker resumed successfully',
    attendance,
    totalPausedTime: `${attendance.totalPausedMinutes} min`,
  });
});

exports.startLunch = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();
  const attendance = await AttendanceModel.findOne({
    employeeId: req.user._id,
    date: currentDate,
  });

  if (!attendance)
    return next(new AppError('No attendance record found for today', 401));

  if (attendance.lunchStart) {
    return next(new AppError('Lunch already started today', 401));
  }

  attendance.lunchStart = new Date();
  await attendance.save();

  res.status(200).json({ message: 'Lunch started', attendance });
});

exports.endLunch = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();
  const attendance = await AttendanceModel.findOne({
    employeeId: req.user._id,
    date: currentDate,
  });

  if (!attendance) {
    return next(new AppError('No attendance record found for today', 401));
  }

  if (!attendance.lunchStart) {
    return next(new AppError('Lunch has not started yet', 401));
  }
  if (attendance.lunchEnd) {
    return next(new AppError('Lunch already ended today', 401));
  }

  // Calculate lunch duration and update paused minutes
  let lunchMinutes = (new Date() - attendance.lunchStart) / 60000; // Convert ms to minutes
  attendance.lunchMinutes += Math.round(lunchMinutes);
  attendance.lunchEnd = new Date();

  await attendance.save();

  res.status(200).json({ message: 'Lunch ended', attendance });
});

exports.startBreak = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();
  const attendance = await AttendanceModel.findOne({
    employeeId: req.user._id,
    date: currentDate,
  });

  if (!attendance)
    return next(new AppError('No attendance record found for today', 401));

  if (attendance.breakStart) {
    return next(new AppError('Break already started today', 401));
  }

  attendance.breakStart = new Date();
  await attendance.save();

  res.status(200).json({ message: 'Break started', attendance });
});

exports.endBreak = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();
  const attendance = await AttendanceModel.findOne({
    employeeId: req.user._id,
    date: currentDate,
  });

  if (!attendance) {
    return next(new AppError('No attendance record found for today', 401));
  }

  if (!attendance.breakStart) {
    return next(new AppError('Break has not started yet', 401));
  }
  if (attendance.breakEnd) {
    return next(new AppError('Break already ended today', 401));
  }

  // Calculate break duration and update paused minutes
  let breakMinutes = (new Date() - attendance.breakStart) / 60000; // Convert ms to minutes
  attendance.breakMinutes += Math.round(breakMinutes);
  attendance.breakEnd = new Date();

  await attendance.save();

  res.status(200).json({ message: 'Break ended', attendance });
});

exports.markLatePunch = catchAsync(async (req, res, next) => {
  res.status(200).json({ message: 'Break ended', attendance });
});

exports.getEmployeeAttendance = catchAsync(async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      sortField = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = { employeeId: req.user._id };

    // Apply date range filter if provided
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Calculate the skip and limit values for pagination
    const skip = (page - 1) * limit;

    // Sort options
    const sortOptions = {};
    sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;

    // console.log('Query:', query);
    // console.log('Sort Options:', sortOptions);

    const totalRecords = await AttendanceModel.countDocuments(query);
    // console.log('Total Records:', totalRecords);

    const attendanceRecords = await AttendanceModel.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // console.log('Attendance Records:', attendanceRecords);

    res.status(200).json({
      status: 'success',
      data: {
        attendanceRecords,
        page: parseInt(page),
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return next(
      new AppError('Error retrieving employee attendance records', 401)
    );
  }
});

exports.getEmployeeTodayAttendance = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();

  try {
    const attendanceRecord = await AttendanceModel.findOne({
      employeeId: req.user._id,
      date: currentDate,
    });

    if (!attendanceRecord) {
      return res.status(201).json(attendanceRecord);
    }

    res.status(200).json(attendanceRecord);
  } catch (err) {
    console.error(err);
    return next(
      new AppError('Error retrieving employee attendance record', 401)
    );
  }
});

//----------------------------------- END -------------------------------//

//----------------------------------------- Cron JOB -----------------------------------//

// exports.sendEmail_MorningShift = catchAsync(async (req, res, next) => {
//   // Morning shift cron job
//   cron.schedule('30 7 * * *', async () => {
//     const employees = await Employee.find({ role: 'Employee' });
//     const morningShiftEmployees = employees.filter(
//       (employee) => employee.shifts === 'Morning'
//     );

//     const currentDate = moment().startOf('day').toDate();

//     for (const employee of morningShiftEmployees) {
//       const attendanceRecord = await AttendanceModel.findOne({
//         employeeId: employee._id,
//         date: currentDate,
//       });

//       if (!attendanceRecord || !attendanceRecord.checkInTime) {
//         console.log(`Sending email to ${employee.name}`);
//         new Email(employee, '').sendCheckInEmail();
//       } else {
//         console.log(`Check in  ${employee.name}`);
//       }
//     }
//   });
// });

// exports.markingAbsent_MorningShift = catchAsync(async (req, res, next) => {
//   // Morning shift cron job
//   cron.schedule('30 8 * * *', async () => {
//     const employees = await Employee.find({ role: 'Employee' });
//     const morningShiftEmployees = employees.filter(
//       (employee) => employee.shifts === 'Morning'
//     );

//     const currentDate = moment().startOf('day').toDate();
//     // const checkInDeadline = moment().startOf('day').add(8, 'hours').toDate();

//     for (const employee of morningShiftEmployees) {
//       const attendanceRecord = await AttendanceModel.findOne({
//         employeeId: employee._id,
//         date: currentDate,
//       });
//       if (!attendanceRecord || !attendanceRecord.checkInTime) {
//         console.log(`Marking ${employee.name} as absent`);
//         // Create a new attendance record for absent employees
//         const newAttendanceRecord = new AttendanceModel({
//           employeeId: employee._id,
//           employeeName: employee.name,
//           date: currentDate,
//           checkInTime: null,
//           checkOutTime: null,
//           totalHours: '0h:0 mins',
//           status: 'absent',
//           leaveStatus: 'leave',
//         });
//         await newAttendanceRecord.save();
//       } else {
//         console.log(`Check-in recorded for ${employee.name}`);
//       }
//     }
//   });
// });

// exports.sendEmail_GeneralShift = catchAsync(async (req, res, next) => {
//   // Morning shift cron job
//   cron.schedule('30 9 * * *', async () => {
//     const employees = await Employee.find({ role: 'Employee' })

//     const morningShiftEmployees = employees.filter(
//       (employee) => employee.shifts === 'General'
//     );

//     const currentDate = moment().startOf('day').toDate();

//     for (const employee of morningShiftEmployees) {
//       const attendanceRecord = await AttendanceModel.findOne({
//         employeeId: employee._id,
//         date: currentDate,
//       });

//       if (!attendanceRecord || !attendanceRecord.checkInTime) {
//         console.log(`Sending email to ${employee.name}`);
//         new Email(employee, '').sendCheckInEmail();
//       } else {
//         console.log(`Check in  ${employee.name}`);
//       }
//     }
//   });
// });

// exports.markingAbsent_GeneralShift = catchAsync(async (req, res, next) => {
//   // Morning shift cron job
//   cron.schedule('30 10 * * *', async () => {
//     const employees = await Employee.find({ role: 'Employee' });
//     const generalShiftEmployees = employees.filter(
//       (employee) => employee.shifts === 'General'
//     );

//     const currentDate = moment().startOf('day').toDate();
//     // const checkInDeadline = moment().startOf('day').add(8, 'hours').toDate();

//     for (const employee of generalShiftEmployees) {
//       const attendanceRecord = await AttendanceModel.findOne({
//         employeeId: employee._id,
//         date: currentDate,
//       });

//       if (!attendanceRecord || !attendanceRecord.checkInTime) {
//         console.log(`Marking ${employee.name} as absent`);
//         // Create a new attendance record for absent employees
//         const newAttendanceRecord = new AttendanceModel({
//           employeeId: employee._id,
//           employeeName: employee.name,
//           date: currentDate,
//           checkInTime: null,
//           checkOutTime: null,
//           totalHours: '0h:0 mins',
//           status: 'absent',
//           leaveStatus: 'leave',
//         });
//         await newAttendanceRecord.save();
//       } else {
//         console.log(`Check-in recorded for ${employee.name}`);
//       }
//     }
//   });
// });

// exports.sendEmail_EveningShift = catchAsync(async (req, res, next) => {
//   // evening shift cron job
//   cron.schedule('30 15 * * *', async () => {
//     const employees = await Employee.find({ role: 'Employee' })
//     const morningShiftEmployees = employees.filter(
//       (employee) => employee.shifts === 'Evening'
//     );

//     const currentDate = moment().startOf('day').toDate();

//     for (const employee of morningShiftEmployees) {
//       const attendanceRecord = await AttendanceModel.findOne({
//         employeeId: employee._id,
//         date: currentDate,
//       });

//       if (!attendanceRecord || !attendanceRecord.checkInTime) {
//         console.log(`Sending email to ${employee.name}`);
//         new Email(employee, '').sendCheckInEmail();
//       } else {
//         console.log(`Check in  ${employee.name}`);
//       }
//     }
//   });
// });

// exports.markingAbsent_EveningShift = catchAsync(async (req, res, next) => {
//   // Morning shift cron job
//   cron.schedule('30 16 * * *', async () => {
//     const employees = await Employee.find({ role: 'Employee' });
//     const generalShiftEmployees = employees.filter(
//       (employee) => employee.shifts === 'Evening'
//     );

//     const currentDate = moment().startOf('day').toDate();
//     // const checkInDeadline = moment().startOf('day').add(8, 'hours').toDate();

//     for (const employee of generalShiftEmployees) {
//       const attendanceRecord = await AttendanceModel.findOne({
//         employeeId: employee._id,
//         date: currentDate,
//       });

//       if (!attendanceRecord || !attendanceRecord.checkInTime) {
//         console.log(`Marking ${employee.name} as absent`);
//         // Create a new attendance record for absent employees
//         const newAttendanceRecord = new AttendanceModel({
//           employeeId: employee._id,
//           employeeName: employee.name,
//           date: currentDate,
//           checkInTime: null,
//           checkOutTime: null,
//           totalHours: '0h:0 mins',
//           status: 'absent',
//           leaveStatus: 'leave',
//         });
//         await newAttendanceRecord.save();
//       } else {
//         console.log(`Check-in recorded for ${employee.name}`);
//       }
//     }
//   });
// });

exports.handleEmailAlert = async (shiftId, cronTime) => {
  cron.schedule(cronTime, async () => {
    console.log('📧 Email alert cron job running...');

    const employees = await Employee.find({ role: 'Employee' });

    // Correct filter with ObjectId toString comparison
    const shiftEmployees = employees.filter((employee) => {
      return employee.shifts && employee.shifts.toString() === shiftId.toString();
    });

    console.log(`Shift Employees found for email alert: ${shiftEmployees.length}`);

    const currentDate = moment().startOf('day').toDate();
    const currentDay = moment().format('dddd').toLowerCase();



    for (const employee of shiftEmployees) {
      const attendanceRecord = await AttendanceModel.findOne({
        employeeId: employee._id,
        date: currentDate,
      });

      if (currentDay === 'saturday' || currentDay === 'sunday') {
        reason = 'weekend';
        console.log(
          `Weekend: ${currentDay}. No action taken for ${employee.name}`
        );
        continue;
      }

      if (!attendanceRecord || !attendanceRecord.checkInTime) {
        console.log(`Sending check-in reminder email to: ${employee.name}`);
        await new Email(employee, '').sendCheckInEmail(); // Added await for sending email
      } else {
        console.log(`Already checked in: ${employee.name}`);
      }
    }
  },{ timezone : 'Asia/Kolkata' });
};

exports.handleAbsentMarking = async (shift, cronTime) => {

  cron.schedule(cronTime, async () => {

    console.log('Absent marking cron job running...');

    const employees = await Employee.find({ role: 'Employee' });
    
    // const shiftEmployees = employees.filter(
    //   (employee) => {
    //     employee.shifts === shift
    //     // console.log("Shift Employees: ", employee.shifts);
    //     console.log('Shift Employees: ', employee.shifts);
    //     return employee.shifts
    //   }
    // );

    const shiftEmployees = employees.filter((employee) => {
           return employee.shifts && employee.shifts.toString() === shift.toString();
    });
    
    const currentDate = moment().startOf('day').toDate();
    const currentDay = moment().format('dddd').toLowerCase(); // e.g., 'sunday'


    for (const employee of shiftEmployees) {
      const attendanceRecord = await AttendanceModel.findOne({
        employeeId: employee._id,
        date: currentDate,
      });



      // if (!attendanceRecord || !attendanceRecord.checkInTime) {
      //   console.log(`Marking ${employee.name} as absent`);
      //   const newAttendanceRecord = new AttendanceModel({
      //     employeeId: employee._id,
      //     employeeName: employee.name,
      //     date: currentDate,
      //     checkInTime: null,
      //     checkOutTime: null,
      //     totalHours: '0h:0 mins',
      //     status: 'absent',
      //     leaveStatus: 'leave',
      //   });

      //   await newAttendanceRecord.save();
      // } else {
      //   console.log(`Check-in recorded for ${employee.name}`);
      // }

      if (attendanceRecord && attendanceRecord.checkInTime) {
        console.log(`Check-in recorded for ${employee.name}`);
        continue;
      }

      let reason = ''; // To keep reason for absent

      // 1. Check Weekend (Saturday and Sunday are weekends)
      if (currentDay === 'saturday' || currentDay === 'sunday') {
        reason = 'weekend';
        console.log(
          `Weekend: ${currentDay}. No action taken for ${employee.name}`
        );
        continue;
      }

      // 2. Check Holiday // 2025-04-09T00:00:00.000Z this is the format of date of holiday in db
      
      const getTodayDateISOString = () => {
        const now = new Date();
        const utcStartOfDay = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate()
        ));
        return utcStartOfDay.toISOString(); 
      };
      
      const todayDate = getTodayDateISOString();

      const isHoliday = await HolidaysModel.findOne({ fromDate: todayDate });

      

      if (isHoliday) {
        reason = 'holiday';
        console.log(
          `It's Holiday today: ${currentDay}. No action taken for ${employee.name}`
        );
        continue;
      }

      // 3. Check Approved Leave
      const isOnLeave = await leavesModel.findOne({
        employeeId: employee._id,
        status: 'approved',
      });
      if (isOnLeave) {
        reason = 'leave';
        console.log(`${employee.name} marked Leave due to approved leave.`);
        continue;
      }

      // 4. Mark Absent
      reason = 'absent';
      console.log(`Marking ${employee.name} as absent`);

      const newAttendanceRecord = new AttendanceModel({
        employeeId: employee._id,
        employeeName: employee.name,
        date: currentDate,
        checkInTime: null,
        checkOutTime: null,
        totalHours: '0h:0 mins',
        status: reason,
        leaveStatus: 'leave',
      });
      await newAttendanceRecord.save();
    }
  },{ timezone : 'Asia/Kolkata' });
};





//----------------------------------------- END -----------------------------------//

// every 1 month increase personnel leave by 1
// exports.updatePersonnelLeave = catchAsync(async (req, res, next) => {
//   cron.schedule('0 0 5 * *', async () => {
//     // Get all employee IDs
//     const employeesData = await Employee.find(
//       { employementType: 'Permanent' },
//       '_id'
//     );

//     // Extract the employee IDs from the fetched data
//     const employeeIds = employeesData.map((employee) => employee._id);

//     // Update personalLeave count for employees not in probation
//     for (const employeeId of employeeIds) {
//       const leaveType = await employedLeaveModel.findOne({ employeeId });

//       if (leaveType) {
//         // Increment personalLeave by 1
//         leaveType.personalLeave += 1;
//         await leaveType.save();
//       }
//     }
//     console.log('Personal leave count updated for employees.');
//   });
// });

// Update Personal leave ( unused persoanl leave will be carry forward )
exports.updatePersonnelLeave = catchAsync(async (req, res, next) => {
  cron.schedule('0 6 * * *', async () => {
    try {
      console.log('Running cron job: Checking employees who completed 1 year.');

      const oneYearAgo = new Date();
      oneYearAgo.setHours(0, 0, 0, 0);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const employees = await Employee.find(
        {
          employementType: { $ne: 'Probation' },
          joinDate: oneYearAgo,
        },
        '_id'
      );

      if (employees.length === 0) {
        console.log('No employees completed 1 year today.');
        return;
      }

      const employeeIds = employees.map((emp) => emp._id);

      // Update personalLeave for eligible employees
      await employedLeaveModel.updateMany(
        { employeeId: { $in: employeeIds } },
        { $inc: { personalLeave: 6 } }
      );

      console.log(
        `Updated personal leave for ${employeeIds.length} employees.`
      );
    } catch (error) {
      console.error('Error running cron job:', error);
    }
  },{ timezone : 'Asia/Kolkata' });
});

//*/1 * * * *
// Reset casualLeave to 6 on every 1st April
exports.resetCasualLeave = catchAsync(async (req, res, next) => {
  cron.schedule('0 6 1 4 *', async () => {
    // Runs on every year 1st of April
    // Get all employee IDs
    const employeesData = await Employee.find(
      { employementType: { $ne: 'Probation' } }, // Exclude 'Probation' employementType
      '_id'
    );

    // Extract the employee IDs from the fetched data
    const employeeIds = employeesData.map((employee) => employee._id);

    // Update casualLeave count for employees
    for (const employeeId of employeeIds) {
      const leaveType = await employedLeaveModel.findOne({ employeeId });

      if (leaveType) {
        // Reset casualLeave to 0 on 1st April at 6 AM
        leaveType.casualLeave = 6;
        await leaveType.save();
      }
    }
    console.log('Casual leave count updated for employees.');
  },{ timezone : 'Asia/Kolkata' });
});

// Reset Medical Leave to 6 on every 1st April
exports.resetMedicalLeave = catchAsync(async (req, res, next) => {
  cron.schedule('0 6 1 4 *', async () => {
    // Runs on every year 1st of April
    // Get all employee IDs
    const employeesData = await Employee.find(
      { employementType: { $ne: 'Probation' } }, // Exclude 'Probation' employementType
      '_id'
    );

    // Extract the employee IDs from the fetched data
    const employeeIds = employeesData.map((employee) => employee._id);

    // Update casualLeave count for employees
    for (const employeeId of employeeIds) {
      const leaveType = await employedLeaveModel.findOne({ employeeId });

      if (leaveType) {
        // Reset casualLeave to 0 on 1st April at 6 AM
        leaveType.medicalLeave = 6;
        await leaveType.save();
      }
    }
    console.log('Medical leave count updated for employees.');
  },{ timezone : 'Asia/Kolkata' });
});

exports.resatLWPlLeave = catchAsync(async (req, res, next) => {
  cron.schedule('0 6 1 4 *', async () => {
    // Runs on every year 1st of April
    // Get all employee IDs
    const employeesData = await Employee.find({}, '_id');

    // Extract the employee IDs from the fetched data
    const employeeIds = employeesData.map((employee) => employee._id);

    // Update casualLeave count for employees
    for (const employeeId of employeeIds) {
      const leaveType = await employedLeaveModel.findOne({ employeeId });

      if (leaveType) {
        // Reset casualLeave to 0 on 1st April at 6 AM
        leaveType.LWP = 0;
        await leaveType.save();
      }
    }
    console.log('LWP Leave Reset');
  },{ timezone : 'Asia/Kolkata' });
});

// Dashboard

// Get Today Attendance Count
exports.getTodayAttendanceCount = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();
  try {
    const todayAttendanceCount = await AttendanceModel.find({
      date: currentDate,
    });
    res.status(200).json({
      count: todayAttendanceCount.length,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving attendance records', 401));
  }
});

exports.getTodayLeaveData = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();

  try {
    const todayLeaveData = await leavesModel
      .find({
        status: 'approved',
        leaveDetails: {
          $elemMatch: {
            date: { $eq: currentDate },
          },
        },
      })
      .populate('employeeId');

    res.status(200).json({
      data: todayLeaveData,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving today leave records', 401));
  }
});

exports.getTodayLeaveCount = catchAsync(async (req, res, next) => {
  const currentDate = moment().startOf('day').toDate();
  try {
    const todayAttendance = await AttendanceModel.find({
      date: currentDate,
    });

    const totalEmployees = await User.countDocuments({
      role: { $in: ['Employee', 'HR', 'Management'] },
      active: true,
    });

    const leaveCount = totalEmployees - todayAttendance.length;

    res.status(200).json({
      leaveCount: leaveCount > 0 ? leaveCount : 0,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving attendance records', 500));
  }
});

// Update Employee Profile
exports.updateEmployeeProfile = catchAsync(async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ _id: req.user._id });
    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    // Convert dob
    if (req.body.dob) {
      req.body.dob = new Date(req.body.dob).toISOString();
    }

    // Extract fields from request body
    const updateData = {
      name: req.body.name,
      aadhaarCard: req.body.aadhaarCard,
      panCard: req.body.panCard,
      voterId: req.body.voterId,
      photograph: req.body.photograph,
      addressProof: req.body.addressProof,
      otherDocument: req.body.otherDocument,
      recentMarksheet: req.body.recentMarksheet,
      dob: req.body.dob,
    };

    // Update employee
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return next(new AppError('Error updating employee profile', 500));
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: updatedEmployee,
    });
  } catch (err) {
    console.error('Error updating profile:', err); // Log the actual error
    return next(
      new AppError(err.message || 'Error updating profile data', 500)
    );
  }
});


exports.getEmployeeMonthlyAttendance = catchAsync(async (req,res,next) => {
  try {
    const employeeId = req.user._id;
    const currentMonth = moment().month(); 
    const currentYear = moment().year();

    const allRecords = await AttendanceModel.find({ employeeId });

    // Filter only records from current month
    const monthlyRecords = allRecords.filter(record => {
      const recordDate = moment(record.date);
      return (
        recordDate.month() === currentMonth &&
        recordDate.year() === currentYear
      );
    });

    console.log(`🚩 Fetched ${monthlyRecords.length} `);
    

    // Group by status
    const present = monthlyRecords.filter(r => r.status === 'present').length;
    const absent = monthlyRecords.filter(r => r.status === 'absent').length;
    const leave = monthlyRecords.filter(r => r.status === 'leave').length;

    return res.status(200).json({
      success: true,
      data: {
        present,
        absent,
        leave,
      },
      summary: {
        presentCount: present.length,
        absentCount: absent.length,
        leaveCount: leave.length,
        total: monthlyRecords.length,
      },
    });

  } catch (err) {
    console.error('Error fetching employee monthly attendance:', err);
    return {
      success: false,
      message: err.message || 'Error fetching employee monthly attendance data',
      error: err
    };
  }

})
