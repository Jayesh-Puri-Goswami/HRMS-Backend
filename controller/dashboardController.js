const User = require('../model/admin.model');
const AppError = require('../utills/appError');
const catchAsync = require('../utills/catchAsync');
const Attendance = require('../model/attendance.model')
const moment = require('moment');
const Holidays = require('../model/holidays.model');
const Leaves = require('../model/leaves.model');

exports.getEmployeeData = catchAsync(async (req, res, next) => {
  try {
    const userId = req.user.id;
    const employeeData = await User.findOne({ _id: userId }).populate('shifts');
    if (!employeeData) {
      return next(new AppError('Employee not found', 404));
    }

    // 1. Today's Attendance
    const currentDate = moment().startOf('day').toDate();
    const todayAttendance = await Attendance.findOne({ employeeId: userId, date: currentDate });
    let todayCheckIn = null, todayCheckOut = null, todayBreak = 0;
    if (todayAttendance) {
      todayCheckIn = todayAttendance.checkInTime;
      todayCheckOut = todayAttendance.checkOutTime;
      todayBreak = (todayAttendance.lunchMinutes || 0) + (todayAttendance.breakMinutes || 0) + (todayAttendance.totalPausedMinutes || 0);
    }

    // 2. Monthly Calculations
    const startOfMonth = moment().startOf('month').startOf('day');
    const endOfMonth = moment().endOf('month').endOf('day');
    // Get all attendance for this user in current month
    const monthAttendance = await Attendance.find({
      employeeId: userId,
      date: { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() },
    });

    // Calculate total hours worked in month
    let totalWorkedMinutes = 0;
    monthAttendance.forEach((rec) => {
      if (rec.totalMinutes && rec.status === 'present') {
        totalWorkedMinutes += rec.totalMinutes;
      }
    });

    // Calculate expected working days (exclude weekends, holidays, approved leaves)
    let workingDays = [];
    let day = startOfMonth.clone();
    while (day <= endOfMonth) {
      const dow = day.day();
      if (dow !== 0 && dow !== 6) workingDays.push(day.clone()); // Exclude Sunday(0) and Saturday(6)
      day.add(1, 'day');
    }
    // Remove holidays
    const holidays = await Holidays.find({
      fromDate: { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() },
      isActive: true,
    });
    const holidayDates = holidays.map(h => moment(h.fromDate).format('YYYY-MM-DD'));
    workingDays = workingDays.filter(d => !holidayDates.includes(d.format('YYYY-MM-DD')));
    // Remove approved leaves for this user
    const leaves = await Leaves.find({
      employeeId: userId,
      status: 'approved',
      'leaveDetails.date': { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() },
    });
    let leaveDates = [];
    leaves.forEach(lv => {
      lv.leaveDetails.forEach(ld => {
        const dt = moment(ld.date).format('YYYY-MM-DD');
        if (!leaveDates.includes(dt)) leaveDates.push(dt);
      });
    });
    workingDays = workingDays.filter(d => !leaveDates.includes(d.format('YYYY-MM-DD')));

    // Calculate expected working hours for the month
    let dailyMinutes = 0;
    if (employeeData.shifts && employeeData.shifts.startTime && employeeData.shifts.endTime) {
      const [sh, sm] = employeeData.shifts.startTime.split(':').map(Number);
      const [eh, em] = employeeData.shifts.endTime.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60; // handle overnight shifts
      // Subtract breaks
      diff -= (employeeData.shifts.lunchTime || 0) + (employeeData.shifts.breakTime || 0);
      dailyMinutes = diff;
    }
    const expectedMonthlyMinutes = workingDays.length * dailyMinutes;

    // Format hours/minutes
    function formatHM(mins) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h:${m} mins`;
    }

    return res.status(200).json({
      status: 'success',
      data: {
        ...employeeData.toObject(),
        todayCheckIn,
        todayCheckOut,
        todayBreak: todayBreak ? formatHM(todayBreak) : '0h:0 mins',
        expectedMonthlyHours: formatHM(expectedMonthlyMinutes),
        totalWorkedHours: formatHM(totalWorkedMinutes),
      },
    });
  } catch (error) {
    return next(new AppError('Error fetching employee data', 500));
  }
});

exports.getEmployeeByRole = catchAsync(async (req, res, next) => {
  try {
    const userRole = req.user.role; // Assuming `req.user.role` contains the role of the logged-in user
    let rolesToFetch = [];

    // Determine roles to fetch based on the requesting user's role
    if (userRole === 'Admin') {
      rolesToFetch = ['Admin', 'HR', 'Management', 'TeamLead', 'Employee'];
    } else if (userRole === 'HR') {
      rolesToFetch = ['Admin','HR', 'Management', 'TeamLead', 'Employee'];
    } else if (userRole === 'Management') {
      rolesToFetch = ['Management', 'TeamLead', 'Employee'];
    } else if (userRole === 'TeamLead') {
      rolesToFetch = ['Management','TeamLead', 'Employee'];
    } else if (userRole === 'Employee') {
      rolesToFetch = ['Employee'];
    } else {
      return next(new AppError('Invalid role', 403));
    }

    // Fetch users based on the determined roles
    const employees = await (await User.find({ role: { $in: rolesToFetch } }).select('name _id'))

    if (!employees || employees.length === 0) {
      return next(new AppError('No employees found for the given role', 404));
    }

    return res.status(200).json({
      status: 'success',
      data: employees,
    });
  } catch (error) {
    return next(new AppError('Error fetching employee data', 500));
  }
});



