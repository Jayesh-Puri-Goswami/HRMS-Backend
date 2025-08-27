const AttendanceModel = require('../model/attendance.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const factory = require('./handlerFactory');
const moment = require('moment');
const cron = require('node-cron');
const Email = require('../utills/email');
const Notice = require('../model/notice.model');
const path = require('path');
const fs = require('fs');

const User = require('../model/admin.model')

exports.createNotice = catchAsync(async (req, res, next) => {
  const { title, content, priority } = req.body;

  // Debug logging
  console.log('=== CREATE NOTICE DEBUG ===');
  console.log('Request body:', req.body);
  console.log('Destructured values:', { title, content, priority });
  console.log('Priority type:', typeof priority);
  console.log('Priority value:', priority);
  console.log('========================');

  if (!title || !content) {
    return next(new AppError('Please provide title and content', 400));
  }

  const notice = await Notice.create({ title, content, priority });
  
  // Debug logging for created notice
  console.log('Created notice:', notice);
  console.log('Notice priority:', notice.priority);


  res.status(201).json({
    status: 'success',
    message: 'Notice created successfully',
    data: notice,
  });
});

exports.updateNotice = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) {
    return next(new AppError('Please provide title and content', 400));
  }

  const updatedNotice = await Notice.findByIdAndUpdate(
    id,
    { title, content, priority },
    { new: true, runValidators: true }
  );

  if (!updatedNotice) {
    return next(new AppError('Notice not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Notice updated successfully',
    data: updatedNotice,
  });
});

exports.getAllNotices = catchAsync(async (req, res, next) => {
  const notices = await Notice.find().sort({ createdAt: -1 });


  res.status(200).json({
    status: 'success',
    results: notices.length,
    data: notices,
  });
});

exports.getUserInfoById = catchAsync(async (req, res, next) => {
  const userId = req.params.id;
  const user = await User.findById(userId).select('name profile_image');

  if (!user) {
    return res.status(404).json({
      status: 'fail',
      message: 'User not found',
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      name: user.name,
      profile_image: user.profile_image,
    },
  });
});

exports.getNoticeById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const notice = await Notice.findById(id)
    .populate('readBy', 'name email')
    .populate('queryBy', 'name email');

  if (!notice) {
    return next(new AppError('Notice not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: notice,
  });
});

exports.deleteNotice = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const notice = await Notice.findByIdAndDelete(id);

  if (!notice) {
    return next(new AppError('Notice not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Notice deleted successfully',
  });
});

// **** Employee ****

exports.getAllNoticesEmployee = catchAsync(async (req, res, next) => {
  const notices = await Notice.find().sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: notices.length,
    data: notices,
  });
});

exports.getNoticeByIdEmployee = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;

  const notice = await Notice.findById(id);

  if (!notice) {
    return next(new AppError('Notice not found', 404));
  }

  // Check if userId is already in readBy array
  if (!notice.readBy.includes(userId)) {
    notice.readBy.push(userId);
    await notice.save();
  }

  res.status(200).json({
    status: 'success',
    data: notice,
  });
});

exports.raiseQueryEmployee = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;

  const notice = await Notice.findById(id);

  if (!notice) {
    return next(new AppError('Notice not found', 404));
  }

  // Check if userId is already in readBy array
  if (!notice.queryBy.includes(userId)) {
    notice.queryBy.push(userId);
    await notice.save();
  }

  res.status(200).json({
    status: 'success',
    message: 'Query Raised Successfully',
    data: notice,
  });
});


