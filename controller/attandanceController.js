const AttendanceModel = require('../model/attendance.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const factory = require('./handlerFactory');
const moment = require('moment-timezone');
const cron = require('node-cron');
const Email = require('../utills/email');
const employedLeaveModel = require('../model/employeePaidLeave.model');
const leavesModel = require('../model/leaves.model');
const Shift = require('../model/shift.model');
const User = require('../model/admin.model');
const HolidaysModel = require('../model/holidays.model');
const LeaveRequest = require('../model/leaves.model');

const DailyTaskList = require('../model/dailyTask.model');

// Calculate total hours
const TZ = 'Asia/Kolkata';

//--------------------------------- For Management -------------------------//

exports.getTodayAllEmployeeAttendance = catchAsync(async (req, res, next) => {
  const startOfToday = moment.tz(TZ).startOf('day').toDate();
  const endOfToday = moment.tz(TZ).endOf('day').toDate();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const employeeName = (req.query.employeeName || '').trim();

  try {
    // Find all active employees with allowed roles, optional name filter
    const employeeQuery = {
      role: { $in: ['Employee', 'HR', 'Management', 'TeamLead'] },
      active: true,
      ...(employeeName
        ? { name: { $regex: employeeName, $options: 'i' } }
        : {}),
    };

    const totalEmployees = await Employee.countDocuments(employeeQuery);
    const employees = await Employee.find(employeeQuery)
      .select('_id name profile_image')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const employeeIds = employees.map((e) => e._id);

    // Fetch today's attendance for these employees
    const todaysAttendance = await AttendanceModel.find({
      employeeId: { $in: employeeIds },
      date: { $gte: startOfToday, $lte: endOfToday },
    })
      .populate('shiftId')
      .sort({ createdAt: -1 });

    const attendanceByEmployee = new Map();
    todaysAttendance.forEach((rec) => {
      attendanceByEmployee.set(rec.employeeId.toString(), rec);
    });

    // Construct rows including absent (no record today)
    const rows = employees.map((emp) => {
      const rec = attendanceByEmployee.get(emp._id.toString());
      return {
        checkInTime: rec?.checkInTime || null,
        checkOutTime: rec?.checkOutTime || null,
        leaveStatus: rec?.leaveStatus || null,
        date: startOfToday,
        employeeName: emp.name,
        status: rec?.status || 'not_in_office',
        totalHours: rec?.totalHours || '0',
        employeeId: { _id: emp._id, profile_image: emp.profile_image },
        shift: rec?.shiftId
          ? {
              name: rec.shiftId.name,
              _id: rec.shiftId._id,
              startTimeFormatted: rec.shiftId.startTimeFormatted,
              endTimeFormatted: rec.shiftId.endTimeFormatted,
            }
          : null,
      };
    });

    res.status(200).json({
      attendanceRecords: rows,
      page,
      totalCount: Math.ceil(totalEmployees / limit),
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
      $gte: moment.tz(startDate, TZ).startOf('day').toDate(),
      $lte: moment.tz(endDate, TZ).endOf('day').toDate(),
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
      $gte: moment.tz(startDate, TZ).startOf('day').toDate(),
      $lte: moment.tz(endDate, TZ).endOf('day').toDate(),
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

  const startOfMonth = moment.tz(TZ).startOf('month').startOf('day').toDate();
  const endOfMonth = moment.tz(TZ).endOf('month').endOf('day').toDate();

  try {
    // Fetch all attendance records for this employee in the current month
    const attendanceRecords = await AttendanceModel.find({
      employeeId: employeeId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    // Map dates where attendance is recorded
    const attendanceByDate = {};
    attendanceRecords.forEach((record) => {
      const dateKey = moment(record.date).tz(TZ).format('YYYY-MM-DD');
      attendanceByDate[dateKey] = record.status; // 'present' or 'absent'
    });

    // Calculate all working days of the month (excluding Saturdays and Sundays)
    const totalWorkingDays = [];
    let current = moment(startOfMonth).tz(TZ);
    while (current <= moment(endOfMonth).tz(TZ)) {
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

exports.addAttendanceByID = catchAsync(async (req, res, next) => {
  const { employeeId, date, checkInTime, checkOutTime, status } = req.body;

  if (!employeeId || !date || !status) {
    return next(new AppError("Employee ID, date, and status are required", 400));
  }

  try {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return next(new AppError("Employee not found", 404));
    }

    // 👇 Always interpret given date+time in Asia/Kolkata, then convert to UTC
    const parseDateTime = (d, t) => {
      if (!t) return null;
      return moment.tz(`${d} ${t}`, "YYYY-MM-DD HH:mm", "Asia/Kolkata").utc().toDate();
    };

    const attendanceDate = moment.tz(date, "YYYY-MM-DD", "Asia/Kolkata").utc().toDate();
    const checkInUTC = parseDateTime(date, checkInTime);
    const checkOutUTC = parseDateTime(date, checkOutTime);

    // Check if attendance already exists for that UTC date
    const existingAttendance = await AttendanceModel.findOne({
      employeeId,
      date: attendanceDate,
    });
    if (existingAttendance) {
      return next(
        new AppError("Attendance record already exists for this employee and date", 400)
      );
    }

    // Calculate hours
    let totalHours = "0h:0 mins";
    let totalMinutes = 0;

    if (checkInUTC && checkOutUTC) {
      const diffMinutes = moment(checkOutUTC).diff(moment(checkInUTC), "minutes");
      totalMinutes = diffMinutes;
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      totalHours = `${hours}h:${minutes} mins`;
    }

    const newAttendance = new AttendanceModel({
      employeeId,
      employeeName: employee.name,
      date: attendanceDate,
      checkInTime: checkInUTC,
      checkOutTime: checkOutUTC,
      status,
      totalHours,
      totalMinutes,
      totalPausedMinutes: 0,
      leaveStatus:
        status === "present"
          ? "working"
          : status === "halfDay"
          ? "halfDay"
          : status === "not_in_office"
          ? "not_in_office"
          : "absent",
    });

    await newAttendance.save();

    res.status(201).json({
      status: "success",
      message: "Attendance record created successfully",
      data: newAttendance,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError("Error creating attendance record", 500));
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
      attendance.leaveStatus =
        status === 'present'
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

      const adjustedMinutes =
        hours * 60 + minutes - (attendance.totalPausedMinutes || 0);
      const finalHours = Math.floor(adjustedMinutes / 60);
      const finalMinutes = adjustedMinutes % 60;

      attendance.totalHours = `${finalHours}h:${finalMinutes} mins`;
      attendance.totalMinutes = adjustedMinutes;

      if (attendance.leaveStatus !== 'absent') {
        attendance.leaveStatus =
          status === 'halfDay' ? 'halfDay' : 'out of working';
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
    const currentDate = moment.tz(TZ).startOf('day');

    // Calculate date 30 days ago for averages
    const thirtyDaysAgo = moment.tz(TZ).subtract(30, 'days').startOf('day');

    // Calculate date 10 days ago for recent attendance
    const tenDaysAgo = moment.tz(TZ).subtract(10, 'days').startOf('day');

    // Fetch attendance records for the last 30 days (for averages)
    const attendanceRecords = await AttendanceModel.find({
      employeeId: employeeId,
      date: { $gte: thirtyDaysAgo.toDate(), $lte: currentDate.toDate() },
      status: 'present', // Only consider days when employee was present
    }).sort({ date: -1 });

    // Fetch last 10 days attendance records
    const recentAttendance = await AttendanceModel.find({
      employeeId: employeeId,
      date: { $gte: tenDaysAgo.toDate(), $lte: currentDate.toDate() },
    }).sort({ date: -1 });

    // Calculate statistics
    let totalWorkingMinutes = 0;
    let totalBreakMinutes = 0;
    let checkInTimes = [];
    let checkOutTimes = [];
    let validRecordsCount = 0;

    attendanceRecords.forEach((record) => {
      // Only include records with both check-in and check-out times
      if (record.checkInTime && record.checkOutTime) {
        validRecordsCount++;

        // Add check-in and check-out times to arrays for averaging
        checkInTimes.push(moment(record.checkInTime).tz(TZ));
        checkOutTimes.push(moment(record.checkOutTime).tz(TZ));

        // Add total working minutes
        totalWorkingMinutes += record.totalMinutes || 0;

        // Add break minutes (lunch + break)
        const breakMins =
          (record.lunchMinutes || 0) + (record.breakMinutes || 0);
        totalBreakMinutes += breakMins;
      }
    });

    // Calculate averages
    const avgWorkingMinutes =
      validRecordsCount > 0 ? totalWorkingMinutes / validRecordsCount : 0;
    const avgBreakMinutes =
      validRecordsCount > 0 ? totalBreakMinutes / validRecordsCount : 0;

    // Calculate average check-in and check-out times
    let avgCheckInTime = null;
    let avgCheckOutTime = null;

    if (checkInTimes.length > 0) {
      // Convert all times to minutes since midnight for averaging
      const checkInMinutes = checkInTimes.map(
        (time) => time.hours() * 60 + time.minutes()
      );
      const avgCheckInMinutes =
        checkInMinutes.reduce((sum, mins) => sum + mins, 0) /
        checkInMinutes.length;

      // Convert back to time format
      const hours = Math.floor(avgCheckInMinutes / 60);
      const minutes = Math.round(avgCheckInMinutes % 60);
      avgCheckInTime = `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
    }

    if (checkOutTimes.length > 0) {
      // Convert all times to minutes since midnight for averaging
      const checkOutMinutes = checkOutTimes.map(
        (time) => time.hours() * 60 + time.minutes()
      );
      const avgCheckOutMinutes =
        checkOutMinutes.reduce((sum, mins) => sum + mins, 0) /
        checkOutMinutes.length;

      // Convert back to time format
      const hours = Math.floor(avgCheckOutMinutes / 60);
      const minutes = Math.round(avgCheckOutMinutes % 60);
      avgCheckOutTime = `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
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
        averageBreakTime: `${Math.floor(avgBreakMinutes / 60)}h:${Math.round(
          avgBreakMinutes % 60
        )} mins`,
        averageBreakMinutes: avgBreakMinutes,
        daysAnalyzed: validRecordsCount,
      },
      recentAttendance: recentAttendance.map((record) => ({
        date: moment(record.date).tz(TZ).format('YYYY-MM-DD'),
        status: record.status,
        checkInTime: record.checkInTime
          ? moment(record.checkInTime).tz(TZ).format('HH:mm:ss')
          : null,
        checkOutTime: record.checkOutTime
          ? moment(record.checkOutTime).tz(TZ).format('HH:mm:ss')
          : null,
        totalHours: record.totalHours,
        breakTime: `${Math.floor(
          (record.lunchMinutes || 0 + record.breakMinutes || 0) / 60
        )}h:${Math.round(
          (record.lunchMinutes || 0 + record.breakMinutes || 0) % 60
        )} mins`,
      })),
    };

    res.status(200).json({
      status: 'success',
      data: response,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error calculating employee statistics', 500));
  }
});

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

// Optimized Check-In Controller
exports.checkIn = catchAsync(async (req, res, next) => {
  const currentDate = moment.tz(TZ).startOf('day').toDate();
  const checkInTime = new Date();

  try {
    const existingEmployee = await Employee.findOne({ _id: req.user._id });
    if (!existingEmployee) {
      return next(new AppError('Employee data not found!', 401));
    }

    // Check if attendance record already exists for today
    const existingAttendance = await AttendanceModel.findOne({
      employeeId: req.user._id,
      date: currentDate,
    });

    // If check-in already exists and status is not null -> prevent duplicate check-in
    if (
      existingAttendance &&
      existingAttendance?.checkInTime &&
      existingAttendance?.status !== null
    ) {
      return next(
        new AppError(
          `Looks like your attendance is already marked as ${existingAttendance.status} today!`,
          400
        )
      );
    }

    if( existingAttendance?.status === 'absent'){
      return next(new AppError('You are absent today!', 400));
    }

    // Get employee's sh  ift information
    const shiftId = existingEmployee.shifts;
    const shift = await Shift.findOne({ _id: shiftId });
    if (!shift) {
      return next(new AppError('Shift data not found!', 401));
    }

    // Decide status based on existing record status and leave (half-day) rules
    let status = 'present';
    let leaveStatus = 'working';
    let checkInReason = 'Regular check-in';

    if (existingAttendance) {
      if (existingAttendance.status === 'not_in_office') {
        status = 'late_check_in';
        leaveStatus = 'late_check_in';
        checkInReason = 'Late check-in';
      } else if (existingAttendance.status === 'halfDay') {
        status = 'halfDay';
        leaveStatus = 'halfDay';
        checkInReason = 'Present on half-day leave';
      } else {
        // status is null or anything other than not_in_office
        status = 'present';
        leaveStatus = 'working';
        checkInReason = 'Regular check-in';
      }
    } else {
      // No record created by cron; check if approved half-day leave exists for today
      const approvedHalfDay = await LeaveRequest.findOne({
        employeeId: req.user._id,
        status: 'approved',
        'leaveDetails.date': currentDate,
        'leaveDetails.halfDay': true,
      });

      if (approvedHalfDay) {
        // Double-check the specific leave detail for today has halfDay
        const leaveDetail = approvedHalfDay.leaveDetails.find((detail) =>
          moment(detail.date).tz(TZ).isSame(moment(currentDate).tz(TZ), 'day') &&
          detail.halfDay === true
        );
        if (leaveDetail) {
          status = 'halfDay';
          leaveStatus = 'halfDay';
          checkInReason = 'Present on half-day leave';
        }
      }
    }

    // Create or update attendance record
    const attendanceData = {
      employeeId: req.user._id,
      employeeName: existingEmployee.name,
      date: currentDate,
      checkInTime,
      totalHours: '0',
      status,
      leaveStatus,
      shiftId: shift ? shift._id : null,
      shiftStartTime: shift ? shift.startTime : null,
      shiftEndTime: shift ? shift.endTime : null,
      shiftLunchTime: shift ? shift.lunchTime : 0,
      shiftBreakTime: shift ? shift.breakTime : 0,
    };

    let attendance;
    if (existingAttendance) {
      attendance = await AttendanceModel.findByIdAndUpdate(
        existingAttendance._id,
        { $set: attendanceData },
        { new: true }
      );
    } else {
      attendance = new AttendanceModel(attendanceData);
      await attendance.save();
    }

    if (status === 'late_check_in') {
      new Email(existingEmployee, '').sendLateCheckInEmail();
    }

    res.status(200).json({
      status: 'success',
      message: checkInReason,
      data: attendance,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error processing check-in', 500));
  }
});

// Optimized Check-Out Controller
exports.checkOut = catchAsync(async (req, res, next) => {
  const currentDate = moment.tz(TZ).startOf('day').toDate();
  const checkOutTime = new Date();

  try {
    // Find today's attendance record
    const attendance = await AttendanceModel.findOne({
      employeeId: req.user._id,
      date: currentDate,
    });

    if (!attendance) {
      return next(
        new AppError(
          'No attendance record found for today. Please check in first.',
          400
        )
      );
    }

    if (!attendance.checkInTime) {
      return next(
        new AppError('Cannot check out without checking in first', 400)
      );
    }

    if (attendance.checkOutTime) {
      return next(new AppError('Already checked out for today', 400));
    }

    // Handle active breaks/lunch
    if (attendance.lunchStart && !attendance.lunchEnd) {
      const lunchMinutes = Math.round(
        (checkOutTime - attendance.lunchStart) / 60000
      );
      attendance.lunchMinutes += lunchMinutes;
      attendance.lunchEnd = checkOutTime;
    }

    if (attendance.breakStart && !attendance.breakEnd) {
      const breakMinutes = Math.round(
        (checkOutTime - attendance.breakStart) / 60000
      );
      attendance.breakMinutes += breakMinutes;
      attendance.breakEnd = checkOutTime;
    }

    // Calculate total working hours
    const { hours, minutes } = calculateTotalHours(
      attendance.checkInTime,
      checkOutTime
    );
    const totalBreakMinutes =
      (attendance.lunchMinutes || 0) + (attendance.breakMinutes || 0);
    const adjustedMinutes =
      hours * 60 +
      minutes -
      totalBreakMinutes -
      (attendance.totalPausedMinutes || 0);

    const finalHours = Math.floor(adjustedMinutes / 60);
    const finalMinutes = adjustedMinutes % 60;

    // Determine if it's a half day based on working hours
    const shift = await Shift.findById(attendance.shiftId);
    let updatedStatus = attendance.status;
    let updatedLeaveStatus = attendance.leaveStatus;

    if (shift) {
      const shiftDurationMinutes = shift.totalWorkingTimeWithoutBreaks;
      const halfDayThreshold = shiftDurationMinutes / 2;

      if (adjustedMinutes <= halfDayThreshold && adjustedMinutes > 0) {
        updatedStatus = 'halfDay';
        updatedLeaveStatus = 'halfDay';
      } else if (adjustedMinutes > 0) {
        updatedLeaveStatus = 'completed';
      }
    }

    attendance.checkOutTime = checkOutTime;
    attendance.totalHours = `${finalHours}h:${finalMinutes} mins`;
    attendance.totalMinutes = adjustedMinutes;
    attendance.status = updatedStatus;
    attendance.leaveStatus = updatedLeaveStatus;

    await attendance.save();

    res.status(200).json({
      status: 'success',
      message: 'Check-out successful',
      data: {
        attendance,
        totalWorkingTime: `${finalHours}h:${finalMinutes} mins`,
        totalWorkingMinutes: adjustedMinutes,
      },
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error processing check-out', 500));
  }
});

// Optimized Handle Not In Office Marking (Professional Terminology)
exports.handleNotInOfficeMarking = async (shift, cronTime) => {
  cron.schedule(
    cronTime,
    async () => {
      console.log(`🕐 Running not in office marking cron: ${cronTime}`);

      try {
        const employees = await Employee.find({ role: 'Employee' });
        const shiftEmployees = employees.filter((employee) => {
          return (
            employee.shifts && employee.shifts.toString() === shift.toString()
          );
        });

        const currentDate = moment.tz(TZ).startOf('day').toDate();
        const currentDay = moment.tz(TZ).format('dddd').toLowerCase();
        const todayDateISO = moment.tz(TZ).startOf('day').toISOString();

        console.log(
          `Processing ${shiftEmployees.length} employees for shift ${shift}`
        );

        for (const employee of shiftEmployees) {
          // Check if attendance record already exists
          const existingAttendance = await AttendanceModel.findOne({
            employeeId: employee._id,
            date: currentDate,
          });

          // TODO : check if status is present and check-in time is present then skip
          // Skip if employee already has check-in data
          if (existingAttendance && existingAttendance.checkInTime) {
            console.log(`✅ ${employee.name} already checked in`);
            continue;
          }

          if (
            existingAttendance &&
            existingAttendance.status === 'not_in_office'
          ) {
            console.log(`✅ Cron already marked as not in office`);
            continue;
          }

          // Decide final status
          let status = 'not_in_office';
          let leaveStatus = 'not_in_office';
          let reason = '';

          // 1. Check if today is a holiday
          const isHoliday = await HolidaysModel.findOne({
            fromDate: todayDateISO,
            isActive: true,
          });
          if (isHoliday) {
            status = 'holiday';
            leaveStatus = 'holiday';
            reason = 'Company holiday';
            console.log(`🏖️ ${employee.name} - Holiday: ${isHoliday.holidayTitle}`);
          } else if (currentDay === 'saturday' || currentDay === 'sunday') {
            // 2. Check if today is weekend
            status = 'weekend';
            leaveStatus = 'weekend';
            reason = 'Weekend';
            console.log(`🌅 ${employee.name} - Weekend: ${currentDay}`);
          } else {
            // 3. Check if employee is on approved leave (including half-day)
            const approvedLeave = await LeaveRequest.findOne({
              employeeId: employee._id,
              status: 'approved',
              'leaveDetails.date': currentDate,
            });
            if (approvedLeave) {
              const leaveDetail = approvedLeave.leaveDetails.find((detail) =>
                moment(detail.date).tz(TZ).isSame(moment(currentDate).tz(TZ), 'day')
              );
              if (leaveDetail && leaveDetail.halfDay) {
                status = 'halfDay';
                leaveStatus = 'halfDay';
                reason = 'Approved half-day leave';
              } else if (leaveDetail) {
                status = 'leave';
                leaveStatus = 'leave';
                reason = 'Approved leave';
              }
              console.log(`📋 ${employee.name} - ${reason}`);
            } else {
              // 4. Mark as not in office (default)
              reason = 'Not present in office';
              console.log(`❌ ${employee.name} - ${reason}`);
            }
          }

          // Upsert attendance record accordingly
          if (existingAttendance) {
            await AttendanceModel.findByIdAndUpdate(
              existingAttendance._id,
              {
                $set: {
                  checkInTime: null,
                  checkOutTime: null,
                  totalHours: '0h:0 mins',
                  status,
                  leaveStatus,
                  shiftId: employee.shifts,
                },
              }
            );
          } else {
            const attendanceRecord = new AttendanceModel({
              employeeId: employee._id,
              employeeName: employee.name,
              date: currentDate,
              checkInTime: null,
              checkOutTime: null,
              totalHours: '0h:0 mins',
              status,
              leaveStatus,
              shiftId: employee.shifts,
            });
            await attendanceRecord.save();
          }
        }

        console.log(`✅ Not in office marking completed for shift ${shift}`);
      } catch (error) {
        console.error('❌ Error in absent marking cron:', error);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );
};

// Optimized Auto Check-Out Employees
exports.autoCheckOutEmployees = async () => {
  cron.schedule(
    '55 23 * * *', // 11 : 55 PM
    async () => {
      console.log('🔄 Auto checkout cron job running...');

      try {
        const startOfDay = moment.tz(TZ).startOf('day').toDate();
        const endOfDay = moment.tz(TZ).endOf('day').toDate();

        // Find all today's records that either:
        // - have check-in but no check-out, or
        // - are currently marked as not_in_office (to mark absent)
        const attendances = await AttendanceModel.find({
          date: { $gte: startOfDay, $lte: endOfDay },
          $or: [
            { status: 'not_in_office' },
            { checkInTime: { $ne: null }, checkOutTime: { $eq: null } },
          ],
        });

        console.log(`Found ${attendances.length} employees to auto process`);

        for (const attendance of attendances) {
          // Case 1: Mark not_in_office -> absent
          if (attendance.status === 'not_in_office') {
            attendance.status = 'absent';
            attendance.leaveStatus = 'absent';
            await attendance.save();
            console.log(`🚫 Marked absent: ${attendance.employeeName}`);
            continue;
          }

          // Case 2: Checked in but not checked out -> checkout with 0 working time
          if (attendance.checkInTime && !attendance.checkOutTime) {
            // Close active lunch/break blocks at check-in time for consistency
            const zeroTime = attendance.checkInTime;
            if (attendance.lunchStart && !attendance.lunchEnd) {
              attendance.lunchEnd = zeroTime;
            }
            if (attendance.breakStart && !attendance.breakEnd) {
              attendance.breakEnd = zeroTime;
            }

            attendance.checkOutTime = zeroTime;
            attendance.totalMinutes = 0;
            attendance.totalHours = '0h:0 mins';
            if (attendance.leaveStatus !== 'absent') {
              attendance.leaveStatus = 'auto_checkout';
            }

            await attendance.save();
            console.log(`✅ Auto checkout (0h) for ${attendance.employeeName}`);
          }
        }

        console.log('✅ Auto checkout cron job completed');
      } catch (error) {
        console.error('❌ Error in auto checkout cron:', error);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );
};

exports.pauseTracker = catchAsync(async (req, res, next) => {
  const currentDate = moment.tz(TZ).startOf('day').toDate();

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
  const currentDate = moment.tz(TZ).startOf('day').toDate();

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
  const currentDate = moment.tz(TZ).startOf('day').toDate();
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
  const currentDate = moment.tz(TZ).startOf('day').toDate();
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
  const currentDate = moment.tz(TZ).startOf('day').toDate();
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
  const currentDate = moment.tz(TZ).startOf('day').toDate();
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
      month,
      year,
    } = req.query;

    let query = { employeeId: req.params.id || req.user._id };

    if (req.user.role === 'HR') {
      query = { employeeId: req.params.id };
    }

    let attendanceRecords;
    let totalRecords;
    let totalPages = 1;
    let currentPage = 1;

    // Monthly filter: if both month and year are provided, filter for that month
    if (month && year) {
      // Parse month (accepts full or short name, case-insensitive)
      const monthNum = moment.tz(TZ).month(month).month(); // month() returns 0-based index
      if (!isNaN(monthNum)) {
        const startOfMonth = moment
          .tz(TZ)
          .year(parseInt(year))
          .month(monthNum)
          .startOf('month')
          .toDate();
        const endOfMonth = moment
          .tz(TZ)
          .year(parseInt(year))
          .month(monthNum)
          .endOf('month')
          .toDate();
        query.date = { $gte: startOfMonth, $lte: endOfMonth };
      } else {
        return next(new AppError('Invalid month parameter', 400));
      }
      // No pagination for monthly filter
      attendanceRecords = await AttendanceModel.find(query).sort({
        [sortField]: sortOrder === 'desc' ? -1 : 1,
      });
      totalRecords = attendanceRecords.length;
      // totalPages and page are always 1 for monthly filter
    } else {
      // Apply date range filter if provided
      if (startDate && endDate) {
        query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
      // Calculate the skip and limit values for pagination
      const skip = (page - 1) * limit;
      // Sort options
      const sortOptions = {};
      sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;
      totalRecords = await AttendanceModel.countDocuments(query);
      attendanceRecords = await AttendanceModel.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));
      totalPages = Math.ceil(totalRecords / limit);
      currentPage = parseInt(page);
    }

    res.status(200).json({
      status: 'success',
      data: {
        attendanceRecords,
        page: currentPage,
        totalPages: totalPages,
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
  const currentDate = moment.tz(TZ).startOf('day').toDate();
  console.log(`Current Date: ${currentDate}`);
  try {
    const attendanceRecord = await AttendanceModel.findOne({
      employeeId: req.user._id,
      date: currentDate,
    });
    console.log(`Attendance Record: ${attendanceRecord}`);

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

exports.handleEmailAlert = async (shiftId, cronTime) => {
  cron.schedule(
    cronTime,
    async () => {
      console.log('Email alert cron job running...');

      const employees = await Employee.find({ role: 'Employee' });
      const shiftEmployees = employees.filter(
        (employee) =>
          employee.shifts && employee.shifts.toString() === shiftId.toString()
      );

      console.log(
        `Shift Employees found for email alert: ${shiftEmployees.length}`
      );

      const currentDate = moment.tz(TZ).startOf('day').toDate();
      const todayDateISO = moment.tz(TZ).startOf('day').toISOString();
      const currentDay = moment.tz(TZ).format('dddd').toLowerCase();

      for (const employee of shiftEmployees) {
        // 1. Check if today is a holiday
        const isHoliday = await HolidaysModel.findOne({
          fromDate: todayDateISO,
          isActive: true,
        });
        if (isHoliday) {
          console.log(`${employee.name} - Holiday: ${isHoliday.holidayTitle}`);
          continue;
        }

        // 2. Check if today is weekend
        if (currentDay === 'saturday' || currentDay === 'sunday') {
          console.log(`${employee.name} - Weekend: ${currentDay}`);
          continue;
        }

        // 3. Check if employee is on approved leave
        const approvedLeave = await LeaveRequest.findOne({
          employeeId: employee._id,
          status: 'approved',
          'leaveDetails.date': currentDate,
        });

        if (approvedLeave) {
          const leaveDetail = approvedLeave.leaveDetails.find((detail) =>
            moment(detail.date).tz(TZ).isSame(moment(currentDate).tz(TZ), 'day')
          );
          if (leaveDetail && leaveDetail.halfDay) {
            console.log(`${employee.name} - Approved half-day leave`);
            continue;
          } else {
            console.log(`${employee.name} - Approved leave`);
            continue;
          }
        }

        // 4. Check if already checked in
        const attendanceRecord = await AttendanceModel.findOne({
          employeeId: employee._id,
          date: currentDate,
        });

        if (!attendanceRecord || !attendanceRecord.checkInTime) {
          console.log(`Sending check-in reminder email to: ${employee.name}`);
          await new Email(employee, '').sendCheckInEmail();
        } else {
          console.log(`Already checked in: ${employee.name}`);
        }
      }
    },
    { timezone: 'Asia/Kolkata' }
  );
};

// Update Personal leave ( unused persoanl leave will be carry forward )
exports.updatePersonnelLeave = catchAsync(async (req, res, next) => {
  cron.schedule(
    '0 6 * * *',
    async () => {
      try {
        console.log(
          'Running cron job: Checking employees who completed 1 year.'
        );

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
    },
    { timezone: 'Asia/Kolkata' }
  );
});

//*/1 * * * *
// Reset casualLeave to 6 on every 1st April
exports.resetCasualLeave = catchAsync(async (req, res, next) => {
  cron.schedule(
    '0 6 1 4 *',
    async () => {
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
    },
    { timezone: 'Asia/Kolkata' }
  );
});

// Reset Medical Leave to 6 on every 1st April
exports.resetMedicalLeave = catchAsync(async (req, res, next) => {
  cron.schedule(
    '0 6 1 4 *',
    async () => {
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
    },
    { timezone: 'Asia/Kolkata' }
  );
});

exports.resatLWPlLeave = catchAsync(async (req, res, next) => {
  cron.schedule(
    '0 6 1 4 *',
    async () => {
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
    },
    { timezone: 'Asia/Kolkata' }
  );
});

// Dashboard

// Get Today Attendance Count
exports.getTodayAttendanceCount = catchAsync(async (req, res, next) => {
  const currentDate = moment.tz(TZ).startOf('day').toDate();
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
  const currentDate = moment.tz(TZ).startOf('day').toDate();

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
  const currentDate = moment.tz(TZ).startOf('day').toDate();
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

    // Prepare update data object
    const updateData = {};

    // Add fields only if they exist in request body
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.email) {
      // Check if email is already taken by another user
      const existingUser = await Employee.findOne({
        email: req.body.email,
        _id: { $ne: req.user._id },
      });
      if (existingUser) {
        return next(
          new AppError('Email already in use by another employee', 400)
        );
      }
      updateData.email = req.body.email;
    }
    if (req.body.phone) updateData.phone = req.body.phone;
    if (req.body.dob) updateData.dob = req.body.dob;
    if (req.body.gender) updateData.gender = req.body.gender;

    // Handle profile image upload
    if (req.files && req.files.profile_image) {
      const profileImage = req.files.profile_image[0];
      if (profileImage && profileImage.filename) {
        updateData.profile_image = profileImage.filename;
      }
    }

    // Document fields (keep existing functionality)
    if (req.body.aadhaarCard) updateData.aadhaarCard = req.body.aadhaarCard;
    if (req.body.panCard) updateData.panCard = req.body.panCard;
    if (req.body.voterId) updateData.voterId = req.body.voterId;
    if (req.body.photograph) updateData.photograph = req.body.photograph;
    if (req.body.addressProof) updateData.addressProof = req.body.addressProof;
    if (req.body.otherDocument)
      updateData.otherDocument = req.body.otherDocument;
    if (req.body.recentMarksheet)
      updateData.recentMarksheet = req.body.recentMarksheet;

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
    console.error('Error updating profile:', err);
    return next(
      new AppError(err.message || 'Error updating profile data', 500)
    );
  }
});

exports.getEmployeeMonthlyAttendance = catchAsync(async (req, res, next) => {
  try {
    const employeeId = req.user._id;
    const currentMonth = moment.tz(TZ).month();
    const currentYear = moment.tz(TZ).year();

    const allRecords = await AttendanceModel.find({ employeeId });

    // Filter only records from current month
    const monthlyRecords = allRecords.filter((record) => {
      const recordDate = moment(record.date).tz(TZ);
      return (
        recordDate.month() === currentMonth && recordDate.year() === currentYear
      );
    });

    console.log(`🚩 Fetched ${monthlyRecords.length} `);

    // Group by status
    const present = monthlyRecords.filter((r) => r.status === 'present').length;
    const absent = monthlyRecords.filter((r) => r.status === 'absent').length;
    const leave = monthlyRecords.filter((r) => r.status === 'leave').length;

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
      error: err,
    };
  }
});

//  New API for Attendance

exports.getDashboardData = catchAsync(async (req, res, next) => {
  const userId = req.user.id; // from authentication middleware

  const today = moment.tz(TZ).startOf('day');
  const monthStart = moment.tz(TZ).startOf('month');
  const monthEnd = moment.tz(TZ).endOf('month');

  // 1. Fetch user and their shift
  const user = await User.findById(userId).populate('shifts');
  if (!user)
    return res.status(404).json({ status: 'fail', message: 'User not found' });

  const shift = user.shifts;
  if (!shift)
    return res
      .status(400)
      .json({ status: 'fail', message: 'Shift not assigned' });

  // Shift time calculation
  const shiftStart = moment.tz(shift.startTime, 'HH:mm', TZ);
  const shiftEnd = moment.tz(shift.endTime, 'HH:mm', TZ);
  let shiftDurationMinutes = shiftEnd.diff(shiftStart, 'minutes');
  // Optionally subtract breaks from shift duration
  // shiftDurationMinutes -= (shift.lunchTime || 0) + (shift.breakTime || 0);

  // ------------------------------------------
  // 2. Today's Attendance
  // ------------------------------------------
  const todayAttendance = await AttendanceModel.findOne({
    employeeId: userId,
    date: { $gte: today.toDate(), $lt: today.clone().endOf('day').toDate() },
  });

  let todayData = {
    scheduled: `${shift.startTime} - ${shift.endTime}`,
    checkIn: '--:--',
    worked: '0h 0m',
    break: '0h 0m',
    balance: `${Math.floor(shiftDurationMinutes / 60)}h ${
      shiftDurationMinutes % 60
    }m`,
    attendance: todayAttendance || null,
    shift: shift,
  };

  if (todayAttendance) {
    // Calculate total break time (lunch + other breaks)
    const breakMinutes =
      (todayAttendance.lunchMinutes || 0) + (todayAttendance.breakMinutes || 0);
    // Worked minutes
    let workedMinutes;
    if (todayAttendance.checkOutTime) {
      // Already checked out
      workedMinutes = todayAttendance.totalMinutes;
    } else if (todayAttendance.checkInTime) {
      // Still working
      const now = moment.tz(TZ);
      workedMinutes = Math.floor(
        now.diff(moment(todayAttendance.checkInTime).tz(TZ), 'minutes') -
          breakMinutes
      );
    } else {
      workedMinutes = 0;
    }
    // Remaining time or overtime
    const balanceMinutes = shiftDurationMinutes - workedMinutes;
    todayData = {
      scheduled: `${shift.startTime} - ${shift.endTime}`,
      checkIn: todayAttendance.checkInTime
        ? moment.utc(todayAttendance.checkInTime).tz(TZ).format('hh:mm A')
        : '--:--',
      worked: `${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m`,
      break: `${Math.floor(breakMinutes / 60)}h ${breakMinutes % 60}m`,
      balance:
        balanceMinutes >= 0
          ? `${Math.floor(balanceMinutes / 60)}h ${balanceMinutes % 60}m`
          : `+${Math.floor(Math.abs(balanceMinutes) / 60)}h ${
              Math.abs(balanceMinutes) % 60
            }m`, // Overtime
      attendance: todayAttendance,
      shift: shift,
    };
  }

  // ------------------------------------------
  // 3. Monthly Attendance & Working Days Calculation
  // ------------------------------------------
  // Get all holidays for this month (active only)
  const holidays = await HolidaysModel.find({
    fromDate: { $gte: monthStart.toDate(), $lte: monthEnd.toDate() },
    isActive: true,
  });
  const holidayDates = holidays.map((h) =>
    moment(h.fromDate).tz(TZ).format('YYYY-MM-DD')
  );

  // Calculate all working days in the month (Mon-Fri, not holidays)
  let workingDays = [];
  let day = monthStart.clone();
  while (day <= monthEnd) {
    const dow = day.day();
    if (
      dow !== 0 &&
      dow !== 6 &&
      !holidayDates.includes(day.format('YYYY-MM-DD'))
    ) {
      workingDays.push(day.clone());
    }
    day.add(1, 'day');
  }

  // Get all attendance for this user in current month
  const monthlyAttendance = await AttendanceModel.find({
    employeeId: userId,
    date: { $gte: monthStart.toDate(), $lte: monthEnd.toDate() },
  });

  let totalWorkedMinutes = 0;
  monthlyAttendance.forEach((att) => {
    // If this is today and not checked out, calculate up-to-now worked minutes
    const isToday = moment(att.date).tz(TZ).isSame(today, 'day');
    if (
      isToday &&
      att.checkInTime &&
      !att.checkOutTime &&
      att.status !== 'absent'
    ) {
      const breakMinutes = (att.lunchMinutes || 0) + (att.breakMinutes || 0);
      const now = moment.tz(TZ);
      const workedMinutes = Math.floor(
        now.diff(moment(att.checkInTime).tz(TZ), 'minutes') - breakMinutes
      );
      totalWorkedMinutes += workedMinutes > 0 ? workedMinutes : 0;
    } else {
      totalWorkedMinutes += att.totalMinutes;
    }
    // console.log(att.totalMinutes);
  });

  const totalScheduledMinutes = workingDays.length * shiftDurationMinutes;
  const overtimeMinutes = Math.max(
    0,
    totalWorkedMinutes - totalScheduledMinutes
  );

  const monthlyData = {
    totalScheduled: `${Math.floor(totalScheduledMinutes / 60)}h ${
      totalScheduledMinutes % 60
    }m`,
    workedTime: `${Math.floor(totalWorkedMinutes / 60)}h ${
      totalWorkedMinutes % 60
    }m`,
    overtime: `${Math.floor(overtimeMinutes / 60)}h ${overtimeMinutes % 60}m`,
    workingDays: workingDays.length,
    workingPercentage: (
      (totalWorkedMinutes / totalScheduledMinutes) *
      100
    ).toFixed(1),
    overtimePercentage: (
      (overtimeMinutes / totalScheduledMinutes) *
      100
    ).toFixed(1),
  };

  const userData = {
    name: user.name,
    email: user.email,
    phone: user.phone,
    department: user.department,
    designation: user.designation,
    profile_image: user.profile_image,
    role: user.role,
    address: user.address,
    joinDate: user.joinDate,
    email: user.email,
    employementType: user.employementType,
  };

  // ------------------------------------------
  // 4. Employee Leave Data Calculation
  // ------------------------------------------
  // Get leave requests for current month
  const currentMonthLeaves = await LeaveRequest.find({
    employeeId: userId,
    'leaveDetails.date': { $gte: monthStart.toDate(), $lte: monthEnd.toDate() },
  });

  // Calculate leave taken this month (approved leaves)
  let leaveTakenTotal = 0;
  let leaveTakenPaid = 0;
  let leaveTakenUnpaid = 0;

  const isPaidType = (type) => {
    if (!type) return false;
    const t = String(type).toLowerCase();
    return t === 'casual' || t === 'personal' || t === 'medical';
  };

  currentMonthLeaves.forEach((leave) => {
    if (leave.status === 'approved') {
      leave.leaveDetails.forEach((detail) => {
        const leaveDate = moment(detail.date);
        if (leaveDate.isBetween(monthStart, monthEnd, null, '[]')) {
          const dayCount = detail.halfDay ? 0.5 : 1;
          leaveTakenTotal += dayCount;

          const effectiveType = detail.leaveType || leave.employeeLeaveType;
          if (isPaidType(effectiveType)) {
            leaveTakenPaid += dayCount;
          } else {
            leaveTakenUnpaid += dayCount;
          }
        }
      });
    }
  });

  // Calculate pending leave requests
  let leaveRequestTotal = 0;
  let leaveRequestPaid = 0;
  let leaveRequestUnpaid = 0;

  currentMonthLeaves.forEach((leave) => {
    if (leave.status === 'pending') {
      leave.leaveDetails.forEach((detail) => {
        const leaveDate = moment(detail.date);
        if (leaveDate.isBetween(monthStart, monthEnd, null, '[]')) {
          const dayCount = detail.halfDay ? 0.5 : 1;
          leaveRequestTotal += dayCount;

          const effectiveType = detail.leaveType || leave.employeeLeaveType;
          if (isPaidType(effectiveType)) {
            leaveRequestPaid += dayCount;
          } else {
            leaveRequestUnpaid += dayCount;
          }
        }
      });
    }
  });

  // Employee leave data in the required format
  const employeeLeaveData = {
    leaveTaken: {
      total: leaveTakenTotal,
      paid: leaveTakenPaid,
      unpaid: leaveTakenUnpaid,
    },
    leaveRequest: {
      total: leaveRequestTotal,
      paid: leaveRequestPaid,
      unpaid: leaveRequestUnpaid,
    },
  };

  // Admin/HR leave statistics (existing code)
  const adminLeaveData = {
    totalEmployee: 0,
    absentEmployees: 0,
    leaveEmployees: 0,
    halfDayEmployees: 0,
  };

  if (user.role === 'Admin' || user.role === 'HR') {
    const today = moment.tz(TZ).startOf('day').toDate();
    const tomorrow = moment.tz(TZ).endOf('day').toDate();

    const totalEmployee = await User.countDocuments({ role: { $ne: 'Admin' } });

    const onLeaveIds = await LeaveRequest.distinct('employeeId', {
      status: 'approved',
      'leaveDetails.date': { $gte: today, $lt: tomorrow },
    });

    const leaveEmployees = onLeaveIds.length;

    const halfDayEmployeeIds = await LeaveRequest.distinct('employeeId', {
      status: 'approved',
      leaveDetails: {
        $elemMatch: { date: { $gte: today, $lt: tomorrow }, halfDay: true },
      },
    });

    const halfDayEmployees = halfDayEmployeeIds.length;

    const presentEmployeeIds = await AttendanceModel.distinct('employeeId', {
      date: { $gte: today, $lt: tomorrow },
    });

    const absentEmployees = await User.countDocuments({
      role: { $ne: 'Admin' },
      _id: { $nin: [...presentEmployeeIds, ...onLeaveIds] },
    });

    adminLeaveData.totalEmployee = totalEmployee;
    adminLeaveData.absentEmployees = absentEmployees;
    adminLeaveData.leaveEmployees = leaveEmployees;
    adminLeaveData.halfDayEmployees = halfDayEmployees;
  }

  res.status(200).json({
    status: 'success',
    data: {
      today: todayData,
      user: userData,
      thisMonth: monthlyData,
      leaveData: employeeLeaveData,
      adminLeaveData: adminLeaveData, // For admin/HR dashboard
    },
  });
});

exports.getEmployeeAttendanceSummary = catchAsync(async (req, res, next) => {
  try {
    const employeeId = req.user._id;
    let { startDate, endDate, month, year } = req.query;
    let rangeStart, rangeEnd;
    // 1. Get employee and their shift information (needed for joinDate)
    const employee = await Employee.findById(employeeId).populate('shifts');
    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }
    const shift = employee.shifts;
    if (!shift) {
      return next(new AppError('No shift assigned to employee', 400));
    }
    // Priority: month+year > year > startDate+endDate > full
    if (month && year) {
      // Accepts full or short month name, case-insensitive
      const monthNum = moment.tz(TZ).month(month).month();
      if (!isNaN(monthNum)) {
        rangeStart = moment
          .tz(TZ)
          .year(parseInt(year))
          .month(monthNum)
          .startOf('month');
        rangeEnd = moment
          .tz(TZ)
          .year(parseInt(year))
          .month(monthNum)
          .endOf('month');
      } else {
        return next(new AppError('Invalid month parameter', 400));
      }
    } else if (year) {
      rangeStart = moment.tz(TZ).year(parseInt(year)).startOf('year');
      rangeEnd = moment.tz(TZ).year(parseInt(year)).endOf('year');
    } else if (startDate && endDate) {
      rangeStart = moment(startDate).startOf('day');
      rangeEnd = moment(endDate).endOf('day');
    } else {
      // Use joinDate to today if no filter
      rangeStart = moment(employee.joinDate).tz(TZ).startOf('day');
      rangeEnd = moment.tz(TZ).endOf('day');
    }

    // 2. Calculate working days in range (excluding weekends and holidays)
    const holidays = await HolidaysModel.find({
      fromDate: { $gte: rangeStart.toDate(), $lte: rangeEnd.toDate() },
      isActive: true,
    });
    const holidayDates = holidays.map((h) =>
      moment(h.fromDate).tz(TZ).format('YYYY-MM-DD')
    );

    let workingDays = [];
    let day = rangeStart.clone();
    while (day <= rangeEnd) {
      const dow = day.day();
      // Exclude weekends (Sunday=0, Saturday=6) and holidays
      if (
        dow !== 0 &&
        dow !== 6 &&
        !holidayDates.includes(day.format('YYYY-MM-DD'))
      ) {
        workingDays.push(day.clone());
      }
      day.add(1, 'day');
    }

    // 3. Calculate total scheduled hours for the range
    const shiftDurationMinutes = shift.totalWorkingTimeWithoutBreaks; // Excluding breaks
    const totalScheduledMinutes = workingDays.length * shiftDurationMinutes;
    const totalScheduledHours = Math.floor(totalScheduledMinutes / 60);
    const totalScheduledMins = totalScheduledMinutes % 60;

    // 4. Get all attendance records for range
    const attendanceRecords = await AttendanceModel.find({
      employeeId: employeeId,
      date: { $gte: rangeStart.toDate(), $lte: rangeEnd.toDate() },
    });

    // 5. Calculate statistics
    let totalActiveMinutes = 0;
    let statusCounts = {
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      leave: 0,
    };

    // Count attendance records by status and calculate total active hours
    attendanceRecords.forEach((record) => {
      // Count status
      if (statusCounts.hasOwnProperty(record.status)) {
        statusCounts[record.status]++;
      } else {
        // Handle any other status as 'other'
        statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
      }

      // Add total working minutes
      if (record.totalMinutes && record.totalMinutes > 0) {
        totalActiveMinutes += record.totalMinutes;
      }
    });

    // Handle today's attendance if still working (not checked out)
    const today = moment.tz(TZ).startOf('day');
    const todayAttendance = attendanceRecords.find((record) =>
      moment(record.date).tz(TZ).isSame(today, 'day')
    );

    if (
      todayAttendance &&
      todayAttendance.checkInTime &&
      !todayAttendance.checkOutTime &&
      todayAttendance.status !== 'absent'
    ) {
      // Calculate current working minutes for today
      const breakMinutes =
        (todayAttendance.lunchMinutes || 0) +
        (todayAttendance.breakMinutes || 0);
      const now = moment.tz(TZ);
      const currentWorkedMinutes = Math.floor(
        now.diff(moment(todayAttendance.checkInTime).tz(TZ), 'minutes') -
          breakMinutes
      );
      if (currentWorkedMinutes > 0) {
        totalActiveMinutes += currentWorkedMinutes;
        // Subtract the stored totalMinutes to avoid double counting
        if (todayAttendance.totalMinutes) {
          totalActiveMinutes -= todayAttendance.totalMinutes;
        }
      }
    }

    const totalActiveHours = Math.floor(totalActiveMinutes / 60);
    const totalActiveMins = totalActiveMinutes % 60;

    // 6. Calculate average behavior (status distribution)
    const totalRecords = attendanceRecords.length;
    const averageBehavior = {};

    if (totalRecords > 0) {
      Object.keys(statusCounts).forEach((status) => {
        if (statusCounts[status] > 0) {
          averageBehavior[status] = {
            count: statusCounts[status],
            percentage: Math.round((statusCounts[status] / totalRecords) * 100),
          };
        }
      });
    }

    // 7. Calculate work availability percentage
    const workAvailabilityPercentage =
      totalScheduledMinutes > 0
        ? Math.round((totalActiveMinutes / totalScheduledMinutes) * 100)
        : 0;

    // 8. Prepare response
    const summaryData = {
      employeeId: employeeId,
      employeeName: employee.name,
      month:
        month && year
          ? `${rangeStart.format('MMMM YYYY')}`
          : year && !month
          ? `${rangeStart.format('YYYY')}`
          : `${rangeStart.format('YYYY-MM-DD')} to ${rangeEnd.format(
              'YYYY-MM-DD'
            )}`,
      shiftInfo: {
        name: shift.name,
        timings: `${shift.startTimeFormatted} - ${shift.endTimeFormatted}`,
        dailyHours: shift.totalWorkingTimeWithoutBreaksHHMM,
      },
      totalScheduledHours: `${totalScheduledHours}h ${totalScheduledMins}m`,
      totalScheduledMinutes: totalScheduledMinutes,
      totalActiveHours: `${totalActiveHours}h ${totalActiveMins}m`,
      totalActiveMinutes: totalActiveMinutes,
      workAvailabilityPercentage: workAvailabilityPercentage,
      averageBehavior: averageBehavior,
      workingDaysInMonth: workingDays.length,
      attendanceRecordsCount: totalRecords,
      summary: {
        efficiency:
          workAvailabilityPercentage >= 90
            ? 'Excellent'
            : workAvailabilityPercentage >= 80
            ? 'Good'
            : workAvailabilityPercentage >= 70
            ? 'Average'
            : 'Needs Improvement',
        mostFrequentStatus: Object.keys(statusCounts).reduce(
          (a, b) => (statusCounts[a] > statusCounts[b] ? a : b),
          'present'
        ),
      },
    };

    res.status(200).json({
      status: 'success',
      data: summaryData,
    });
  } catch (err) {
    console.error('Error calculating employee attendance summary:', err);
    return next(new AppError('Error calculating attendance summary', 500));
  }
});

exports.getHrAttendanceSummary = catchAsync(async (req, res, next) => {
  try {
    const currentDate = moment.tz(TZ).startOf('day').toDate();
    const tomorrow = moment.tz(TZ).endOf('day').toDate();

    // 1. Get total employee count (excluding Admin)
    const totalEmployees = await User.countDocuments({
      role: { $in: ['Employee', 'HR', 'Management', 'TeamLead'] },
      active: true,
    });

    // 2. Get total leave requests (pending + approved + rejected)
    const totalLeaveRequests = await LeaveRequest.countDocuments({});

    // 3. Get employees on leave today (approved leaves)
    const onLeaveToday = await LeaveRequest.find({
      status: 'approved',
      'leaveDetails.date': { $gte: currentDate, $lt: tomorrow },
    }).populate('employeeId', 'name email department designation');

    // Filter out half-day leaves from full-day leaves
    const fullDayLeaves = onLeaveToday.filter((leave) => {
      const todayLeaveDetails = leave.leaveDetails.filter((detail) =>
        moment(detail.date).isSame(currentDate, 'day')
      );
      return todayLeaveDetails.some((detail) => !detail.halfDay);
    });

    const halfDayLeaves = onLeaveToday.filter((leave) => {
      const todayLeaveDetails = leave.leaveDetails.filter((detail) =>
        moment(detail.date).isSame(currentDate, 'day')
      );
      return todayLeaveDetails.some((detail) => detail.halfDay);
    });

    // Get unique employee IDs for counting
    const onLeaveTodayCount = new Set(
      fullDayLeaves.map((leave) => leave?.employeeId?.toString())
    ).size;
    const onHalfDayTodayCount = new Set(
      halfDayLeaves.map((leave) => leave?.employeeId?.toString())
    ).size;

    // 4. Get employees present today
    const presentEmployees = await AttendanceModel.find({
      date: currentDate,
      status: 'present',
    }).populate('employeeId', 'name email department designation');

    // 5. Get employees absent today (not present, not on leave)
    const absentEmployees = await User.find({
      role: { $in: ['Employee', 'HR', 'Management', 'TeamLead'] },
      active: true,
      _id: {
        $nin: [
          ...presentEmployees.map((emp) => emp.employeeId),
          ...onLeaveToday.map((leave) => leave.employeeId),
        ],
      },
    }).select('name email department designation');

    // 6. Get employees with late check-in today
    const lateCheckInEmployees = await AttendanceModel.find({
      date: currentDate,
      status: 'late_check_in',
    }).populate('employeeId', 'name email department designation');

    // 7. Get employees on overtime today
    const overtimeEmployees = await AttendanceModel.find({
      date: currentDate,
      status: 'overtime',
    }).populate('employeeId', 'name email department designation');

    // 8. Calculate attendance statistics
    const attendanceStats = {
      totalEmployees,
      presentToday: presentEmployees.length,
      absentToday: absentEmployees.length,
      onLeaveToday: onLeaveTodayCount,
      onHalfDayToday: onHalfDayTodayCount,
      lateCheckInToday: lateCheckInEmployees.length,
      overtimeToday: overtimeEmployees.length,
      totalLeaveRequests,
    };

    // 9. Prepare detailed employee lists
    const employeeDetails = {
      presentEmployees: presentEmployees.map((emp) => ({
        id: emp.employeeId._id,
        name: emp.employeeId.name,
        email: emp.employeeId.email,
        department: emp.employeeId.department,
        designation: emp.employeeId.designation,
        checkInTime: emp.checkInTime
          ? moment(emp.checkInTime).tz(TZ).format('HH:mm')
          : null,
        checkOutTime: emp.checkOutTime
          ? moment(emp.checkOutTime).tz(TZ).format('HH:mm')
          : null,
        totalHours: emp.totalHours,
      })),
      absentEmployees: absentEmployees.map((emp) => ({
        id: emp._id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        designation: emp.designation,
      })),
      onLeaveEmployees: onLeaveToday.map((leave) => ({
        id: leave.employeeId?._id,
        name: leave.employeeId?.name,
        email: leave.employeeId?.email,
        department: leave.employeeId?.department,
        designation: leave.employeeId?.designation,
        leaveType: leave.employeeLeaveType,
        reason: leave.reason,
        isHalfDay: leave.leaveDetails.some(
          (detail) =>
            moment(detail.date).isSame(currentDate, 'day') && detail.halfDay
        ),
      })),
      lateCheckInEmployees: lateCheckInEmployees.map((emp) => ({
        id: emp.employeeId._id,
        name: emp.employeeId.name,
        email: emp.employeeId.email,
        department: emp.employeeId.department,
        designation: emp.employeeId.designation,
        checkInTime: emp.checkInTime
          ? moment(emp.checkInTime).tz(TZ).format('HH:mm')
          : null,
      })),
      overtimeEmployees: overtimeEmployees.map((emp) => ({
        id: emp.employeeId._id,
        name: emp.employeeId.name,
        email: emp.employeeId.email,
        department: emp.employeeId.department,
        designation: emp.employeeId.designation,
        checkInTime: emp.checkInTime
          ? moment(emp.checkInTime).tz(TZ).format('HH:mm')
          : null,
        totalHours: emp.totalHours,
      })),
    };

    // 10. Get leave request statistics
    const leaveRequestStats = await LeaveRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const leaveRequestBreakdown = {
      pending:
        leaveRequestStats.find((stat) => stat._id === 'pending')?.count || 0,
      approved:
        leaveRequestStats.find((stat) => stat._id === 'approved')?.count || 0,
      rejected:
        leaveRequestStats.find((stat) => stat._id === 'rejected')?.count || 0,
      unapproved:
        leaveRequestStats.find((stat) => stat._id === 'unapproved')?.count || 0,
    };

    // 11. Get department-wise employee counts
    const departments = [
      'game-department',
      'web-department',
      'design-department',
      'qa-department',
      'digital-marketing',
      'management',
      'human-resource',
    ];

    const departmentStats = await User.aggregate([
      {
        $match: {
          role: { $in: ['Employee', 'HR', 'Management', 'TeamLead'] },
          active: true,
        },
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
        },
      },
    ]);

    // Create departments object with counts
    const departmentsCount = {};
    departments.forEach((dept) => {
      const deptData = departmentStats.find((stat) => stat._id === dept);
      departmentsCount[dept] = deptData ? deptData.count : 0;
    });

    res.status(200).json({
      status: 'success',
      data: {
        summary: attendanceStats,
        employeeDetails,
        leaveRequestBreakdown,
        departments: departmentsCount,
        date: moment(currentDate).format('YYYY-MM-DD'),
        generatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error('Error in HR attendance summary:', err);
    return next(new AppError('Error generating HR attendance summary', 500));
  }
});

exports.getEmployeeList = catchAsync(async (req, res, next) => {
  // try {
  console.log(`Employee Running ✌`);
  const { employeeName } = req.query;

  // Build query object
  const query = {
    role: { $in: ['Employee', 'HR', 'Management', 'TeamLead'] },
  };

  // Add name filter if provided
  if (employeeName) {
    query.name = { $regex: employeeName, $options: 'i' };
  }

  const employeeList = await User.find(query)
    .select('name profile_image')
    .sort({ name: 1 }); // Sort alphabetically by name
  res.status(200).json({
    status: 'success',
    data: employeeList,
  });
  // } catch (err) {
  //   console.error('Error in employee list:', err);
  //   return next(new AppError('Error generating employee list', 500));
  // }
});

exports.getEmployeeAttendanceById = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month, year, startDate, endDate } = req.query;

    // Validate employee ID
    if (!id) {
      return next(new AppError('Employee ID is required', 400));
    }

    // Check if employee exists
    const employee = await User.findById(id);
    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    // Build query object
    const query = { employeeId: id };
    let dateFilter = {};

    // Apply date filters based on priority: month+year > year > startDate+endDate > no filter
    if (month && year) {
      // Filter by specific month and year
      const monthNum = moment.tz(TZ).month(month).month(); // month() returns 0-based index
      if (!isNaN(monthNum)) {
        const startOfMonth = moment()
          .year(parseInt(year))
          .month(monthNum)
          .startOf('month')
          .toDate();
        const endOfMonth = moment()
          .year(parseInt(year))
          .month(monthNum)
          .endOf('month')
          .toDate();
        dateFilter = { $gte: startOfMonth, $lte: endOfMonth };
      } else {
        return next(new AppError('Invalid month parameter', 400));
      }
    } else if (year) {
      // Filter by specific year
      const startOfYear = moment()
        .year(parseInt(year))
        .startOf('year')
        .toDate();
      const endOfYear = moment
        .tz(TZ)
        .year(parseInt(year))
        .endOf('year')
        .toDate();
      dateFilter = { $gte: startOfYear, $lte: endOfYear };
    } else if (startDate && endDate) {
      // Filter by date range
      const start = moment(startDate).startOf('day').toDate();
      const end = moment(endDate).endOf('day').toDate();
      dateFilter = { $gte: start, $lte: end };
    }
    // If no date filters provided, get all attendance records for the employee

    // Add date filter to query if specified
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter;
    }

    // Fetch attendance records
    const attendanceRecords = await AttendanceModel.find(query)
      .populate('employeeId', 'name email department designation profile_image')
      .populate(
        'shiftId',
        'name startTime endTime startTimeFormatted endTimeFormatted'
      )
      .sort({ date: -1, createdAt: -1 });

    // Calculate statistics
    let totalRecords = attendanceRecords.length;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;
    let overtimeCount = 0;
    let totalWorkingMinutes = 0;
    let totalBreakMinutes = 0;

    attendanceRecords.forEach((record) => {
      // Count by status
      switch (record.status) {
        case 'present':
          presentCount++;
          break;
        case 'absent':
          absentCount++;
          break;
        case 'late_check_in':
          lateCount++;
          break;
        case 'halfDay':
          halfDayCount++;
          break;
        case 'leave':
          leaveCount++;
          break;
        case 'overtime':
          overtimeCount++;
          break;
        default:
          // Handle other statuses
          break;
      }

      // Calculate total working minutes
      if (record.totalMinutes && record.totalMinutes > 0) {
        totalWorkingMinutes += record.totalMinutes;
      }

      // Calculate total break minutes
      const breakMinutes =
        (record.lunchMinutes || 0) + (record.breakMinutes || 0);
      totalBreakMinutes += breakMinutes;
    });

    // Calculate averages
    const avgWorkingMinutes =
      totalRecords > 0 ? totalWorkingMinutes / totalRecords : 0;
    const avgBreakMinutes =
      totalRecords > 0 ? totalBreakMinutes / totalRecords : 0;

    // Format time values
    const totalWorkingHours = Math.floor(totalWorkingMinutes / 60);
    const totalWorkingMins = totalWorkingMinutes % 60;
    const avgWorkingHours = Math.floor(avgWorkingMinutes / 60);
    const avgWorkingMins = Math.round(avgWorkingMinutes % 60);
    const avgBreakHours = Math.floor(avgBreakMinutes / 60);
    const avgBreakMins = Math.round(avgBreakMinutes % 60);

    // Prepare response data
    const attendanceData = attendanceRecords.map((record) => ({
      _id: record._id,
      date: moment(record.date).format('YYYY-MM-DD'),
      checkInTime: record.checkInTime
        ? moment(record.checkInTime).format('hh:mm A')
        : null,
      checkOutTime: record.checkOutTime
        ? moment(record.checkOutTime).format('hh:mm A')
        : null,
      totalHours: record.totalHours,
      totalMinutes: record.totalMinutes,
      status: record.status,
      leaveStatus: record.leaveStatus,
      lunchMinutes: record.lunchMinutes,
      breakMinutes: record.breakMinutes,
      totalPausedMinutes: record.totalPausedMinutes,
      shift: record.shiftId
        ? {
            _id: record.shiftId._id,
            name: record.shiftId.name,
            startTime: record.shiftId.startTime,
            endTime: record.shiftId.endTime,
            startTimeFormatted: record.shiftId.startTimeFormatted,
            endTimeFormatted: record.shiftId.endTimeFormatted,
          }
        : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));

    // Prepare statistics
    const statistics = {
      totalRecords,
      statusBreakdown: {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        halfDay: halfDayCount,
        leave: leaveCount,
        overtime: overtimeCount,
      },
      timeStatistics: {
        totalWorkingTime: `${totalWorkingHours}h ${totalWorkingMins}m`,
        totalWorkingMinutes: totalWorkingMinutes,
        averageWorkingTime: `${avgWorkingHours}h ${avgWorkingMins}m`,
        averageWorkingMinutes: avgWorkingMinutes,
        totalBreakTime: `${Math.floor(totalBreakMinutes / 60)}h ${
          totalBreakMinutes % 60
        }m`,
        totalBreakMinutes: totalBreakMinutes,
        averageBreakTime: `${avgBreakHours}h ${avgBreakMins}m`,
        averageBreakMinutes: avgBreakMinutes,
      },
      attendancePercentage:
        totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0,
    };

    // Determine filter description
    let filterDescription = 'All time';
    if (month && year) {
      filterDescription = `${moment
        .tz(TZ)
        .month(month)
        .format('MMMM')} ${year}`;
    } else if (year) {
      filterDescription = `Year ${year}`;
    } else if (startDate && endDate) {
      filterDescription = `${moment(startDate).format(
        'MMM DD, YYYY'
      )} - ${moment(endDate).format('MMM DD, YYYY')}`;
    }

    res.status(200).json({
      status: 'success',
      data: {
        employee: {
          _id: employee._id,
          name: employee.name,
          email: employee.email,
          department: employee.department,
          designation: employee.designation,
          profile_image: employee.profile_image,
        },
        filterDescription,
        attendanceRecords: attendanceData,
        statistics,
        totalPages: 1, // Since we're not paginating in this endpoint
        currentPage: 1,
      },
    });
  } catch (err) {
    console.error('Error in employee attendance by id:', err);
    return next(
      new AppError('Error generating employee attendance by id', 500)
    );
  }
});

exports.exportMonthlyAttendance = catchAsync(async (req, res, next) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return next(new AppError('Month and year are required', 400));
    }

    const monthInt = parseInt(month);
    const yearInt = parseInt(year);

    const startDate = new Date(yearInt, monthInt - 1, 1);
    const endDate = new Date(yearInt, monthInt, 0, 23, 59, 59, 999);

    // Get all employees
    const employees = await User.find({
      role: { $in: ['Employee', 'HR', 'Management', 'TeamLead'] },
    }).select('name email');

    // Get attendance records for the month
    const attendanceRecords = await AttendanceModel.find({
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('employeeId', 'name email')
      .lean();

    // Generate all dates in the month
    const daysInMonth = moment(endDate).date();
    const allDates = [];
    for (let d = 1; d <= daysInMonth; d++) {
      allDates.push(
        moment(new Date(yearInt, monthInt - 1, d)).format('DD-MM-YYYY')
      );
    }

    // Prepare report data
    const report = [];

    employees.forEach((emp) => {
      const row = { name: emp.name };

      allDates.forEach((dateStr) => {
        // Find record for this employee & date
        const record = attendanceRecords.find((rec) => {
          return (
            rec.employeeId &&
            rec.employeeId._id.toString() === emp._id.toString() &&
            moment(rec.date).format('DD-MM-YYYY') === dateStr
          );
        });

        if (record) {
          row[dateStr] =
            `Checkin: ${
              record.checkInTime
                ? moment(record.checkInTime).format('HH:mm')
                : '-'
            }\n` +
            `Checkout: ${
              record.checkOutTime
                ? moment(record.checkOutTime).format('HH:mm')
                : '-'
            }\n` +
            `Status: ${record.status || '-'}\n` +
            `Total working hours: ${record.totalHours || '0h:0m'}`;
        } else {
          row[
            dateStr
          ] = `Checkin: -\nCheckout: -\nStatus: absent\nTotal working hours: 0h:0m`;
        }
      });

      report.push(row);
    });

    // Send JSON (you can later convert this to CSV/Excel in frontend)
    res.status(200).json({
      status: 'success',
      month: monthInt,
      year: yearInt,
      dates: allDates,
      data: report,
    });
  } catch (err) {
    console.error('Error exporting monthly attendance:', err);
    return next(new AppError('Error exporting monthly attendance', 500));
  }
});

exports.getTodayLeaveEmployee = catchAsync(async (req, res, next) => {
  try {
    const today = moment().tz(TZ).startOf('day');
    
    const leaveRecords = await LeaveRequest.find({
      fromDate: { $lte: today },
      toDate: { $gte: today },
      status: 'approved',
    })
      .populate('employeeId', 'name email profile_image')
      .sort({ createdAt: -1 });

    // Extract only the employee information from leave records
    const employeesOnLeave = leaveRecords.map(leave => ({
      _id: leave.employeeId._id,
      name: leave.employeeId.name,
      email: leave.employeeId.email,
      profile_image: leave.employeeId.profile_image
    }));

    res.status(200).json({
      status: 'success',
      data: employeesOnLeave,
    });
  } catch (error) {
    console.error('Error getting today leave employee:', error);
    return next(new AppError('Error getting today leave employee', 500));
  }
});

exports.getTodayAbsentEmployee = catchAsync(async (req, res, next) => {
  try {
    const today = moment().tz(TZ).startOf('day');
    
    // Find employees with absent or not_in_office status today
    const absentEmployees = await AttendanceModel.find({
      date: { $gte: today.toDate(), $lt: today.clone().endOf('day').toDate() },
      status: { $in: ['absent', 'not_in_office'] }
    })
      .populate('employeeId', 'name email profile_image')
      .sort({ createdAt: -1 });

    // Extract only the employee information
    const employeesAbsent = absentEmployees.map(attendance => ({
      _id: attendance.employeeId._id,
      name: attendance.employeeId.name,
      email: attendance.employeeId.email,
      profile_image: attendance.employeeId.profile_image
    }));

    res.status(200).json({
      status: 'success',
      data: employeesAbsent,
    });
  } catch (error) {
    console.error('Error getting today absent employee:', error);
    return next(new AppError('Error getting today absent employee', 500));
  }
});


exports.getTodayLateEmployee = catchAsync(async (req, res, next) => {
  try {
    const today = moment().tz(TZ).startOf('day');
    
    // Find employees with late status today
    const lateEmployees = await AttendanceModel.find({
      date: { $gte: today.toDate(), $lt: today.clone().endOf('day').toDate() },
      status: 'late_check_in'
    })
      .populate('employeeId', 'name email profile_image')
      .sort({ createdAt: -1 });

    // Extract only the employee information
    const employeesLate = lateEmployees.map(attendance => ({
      _id: attendance.employeeId._id,
      name: attendance.employeeId.name,
      email: attendance.employeeId.email,
      profile_image: attendance.employeeId.profile_image
    }));

    res.status(200).json({
      status: 'success',
      data: employeesLate,
    });
  } catch (error) {
    console.error('Error getting today late employee:', error);
    return next(new AppError('Error getting today late employee', 500));
  }
});


exports.getMostLeaveAndAbsentEmployee = catchAsync(async (req, res, next) => {
  try {
    const today = moment().tz(TZ).startOf('day');
    const twoMonthsAgo = today.clone().subtract(2, 'months').startOf('month');
    
    // Calculate working days in the last 2 months (excluding weekends and holidays)
    const holidays = await HolidaysModel.find({
      fromDate: { $gte: twoMonthsAgo.toDate(), $lte: today.toDate() },
      isActive: true,
    });
    
    const holidayDates = holidays.map(h => 
      moment(h.fromDate).tz(TZ).format('YYYY-MM-DD')
    );
    
    // Calculate total working days in the last 2 months
    let totalWorkingDays = 0;
    let currentDate = twoMonthsAgo.clone();
    
    while (currentDate <= today) {
      const dayOfWeek = currentDate.day(); // 0 = Sunday, 6 = Saturday
      const dateString = currentDate.format('YYYY-MM-DD');
      
      // Exclude weekends and holidays
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.includes(dateString)) {
        totalWorkingDays++;
      }
      currentDate.add(1, 'day');
    }
    
    // Calculate absence threshold (15% of working days)
    const absenceThreshold = Math.ceil(totalWorkingDays * 0.15);
    
    // Get all employees
    const allEmployees = await User.find({
      role: { $in: ['Employee', 'HR', 'Management', 'TeamLead'] },
      active: true,
    }).select('_id name email profile_image');
    
    // Get attendance records for the last 2 months
    const attendanceRecords = await AttendanceModel.find({
      date: { $gte: twoMonthsAgo.toDate(), $lte: today.toDate() },
      status: { $in: ['absent', 'not_in_office'] }
    });
    
    // Get leave records for the last 2 months
    const leaveRecords = await LeaveRequest.find({
      status: 'approved',
      fromDate: { $gte: twoMonthsAgo.toDate() },
      toDate: { $lte: today.toDate() }
    });
    
    // Calculate absence count for each employee
    const employeeAbsenceCount = {};
    const employeeLeaveCount = {};
    
    // Initialize counts
    allEmployees.forEach(emp => {
      employeeAbsenceCount[emp._id.toString()] = 0;
      employeeLeaveCount[emp._id.toString()] = 0;
    });
    
    // Count absences
    attendanceRecords.forEach(record => {
      const empId = record.employeeId.toString();
      if (employeeAbsenceCount[empId] !== undefined) {
        employeeAbsenceCount[empId]++;
      }
    });
    
    // Count leaves (including half-day leaves)
    leaveRecords.forEach(leave => {
      const empId = leave.employeeId.toString();
      if (employeeLeaveCount[empId] !== undefined) {
        leave.leaveDetails.forEach(detail => {
          const leaveDate = moment(detail.date);
          if (leaveDate.isBetween(twoMonthsAgo, today, null, '[]')) {
            // Count half-day as 0.5, full day as 1
            const leaveDays = detail.halfDay ? 0.5 : 1;
            employeeLeaveCount[empId] += leaveDays;
          }
        });
      }
    });
    
    // Find employees with high absence rate (>15%) or high leave count
    const mostLeaveAndAbsentEmployees = allEmployees.filter(emp => {
      const absenceCount = employeeAbsenceCount[emp._id.toString()] || 0;
      const leaveCount = employeeLeaveCount[emp._id.toString()] || 0;
      
      // Include employees who are absent >15% OR take frequent leaves
      return absenceCount >= absenceThreshold || leaveCount >= 5; // 5 days threshold for leaves
    }).map(emp => ({
      _id: emp._id,
      name: emp.name,
      email: emp.email,
      profile_image: emp.profile_image
    }));
    
    res.status(200).json({
      status: 'success',
      data: mostLeaveAndAbsentEmployees
    });
    
  } catch (error) {
    console.error('Error getting most leave and absent employees:', error);
    return next(new AppError('Error getting most leave and absent employees', 500));
  }
});