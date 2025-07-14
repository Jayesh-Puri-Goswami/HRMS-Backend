const AttendanceModel = require('../model/attendance.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const factory = require('./handlerFactory');
const moment = require('moment');
const cron = require('node-cron');
const Email = require('../utills/email');
const Shift = require('../model/shift.model');

exports.createShift = catchAsync(async (req, res, next) => {
  const { name, startTime, endTime, lunchTime, breakTime } = req.body;

  // Validate required fields
  if (!name || !startTime || !endTime) {
    return next(
      new AppError('Please provide name, startTime, and endTime', 400)
    );
  }

  // Check if a shift with the same name already exists
  const existShift = await Shift.findOne({ name });

  if (existShift) {
    return next(new AppError('Shift already exists. Please use a different name', 400));
  }


  const lunchTimeMinutes = Number(lunchTime) || 0;
  const breakTimeMinutes = Number(breakTime) || 0;

  const shift = await Shift.create({
    name,
    startTime,
    endTime,
    lunchTime: lunchTimeMinutes,
    breakTime: breakTimeMinutes,
  });

  res.status(201).json({
    status: 'success',
    message: 'Shift created',
    data: shift,
  });
});

exports.updateShift = catchAsync(async (req, res, next) => {
  const { name, startTime, endTime, lunchTime, breakTime } = req.body;
  const { id } = req.params;

  // Ensure lunchTime and breakTime are always numbers (default to 0 if not provided)
  const updateData = {
    name,
    startTime,
    endTime,
    lunchTime: Number(lunchTime) || 0,
    breakTime: Number(breakTime) || 0,
  };

  // Find and update the shift
  const shift = await Shift.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!shift) {
    return next(new AppError('Shift not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Shift updated successfully',
    data: shift,
  });
});


exports.getAllShifts = catchAsync(async (req, res, next) => {
  const shifts = await Shift.find();

  res.status(200).json({
    status: 'success',
    results: shifts.length,
    data: shifts,
  });
});