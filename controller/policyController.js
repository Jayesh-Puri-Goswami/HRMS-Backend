const AttendanceModel = require('../model/attendance.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const factory = require('./handlerFactory');
const moment = require('moment');
const cron = require('node-cron');
const Email = require('../utills/email');
const Policy = require('../model/policy.model');
const path = require('path');
const fs = require('fs');

exports.createPolicy = catchAsync(async (req, res, next) => {
  const { policyType, policyVersion, description } = req.body;

  // Validate required fields
  if (!policyType) {
    return next(new AppError('Please provide policyType', 400));
  }

  if (!policyVersion) {
    return next(new AppError('Please provide policyVersion', 400));
  }

  if (!req.file) {
    return next(new AppError('Please provide a policy file', 400));
  }

  // Check if policy already exists
  const existingPolicy = await Policy.findOne({ policyType, policyVersion });

  if (existingPolicy) {
    return next(
      new AppError(
        'A policy with the same name and version already exists',
        400
      )
    );
  }

  const file = req.file;
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const timestamp = Date.now();
  const filename = `${policyType}-${timestamp}${fileExtension}`;

  // Validate file type
  if (!['.pdf'].includes(fileExtension)) {
    return next(new AppError('Unsupported file type', 400));
  }

  const filePath = path.join('public/policies', filename);

  // Save the file to the filesystem
  await fs.promises.writeFile(filePath, file.buffer);

  // Store policy data in the database
  const policy = await Policy.create({
    policyType,
    policyVersion,
    file: filename,
    description
    });

  if (!policy) {
    return next(new AppError('write some error', 500));
  }

  // Notification To Employees

  res.status(201).json({
    status: 'success',
    message: 'Policy created successfully',
    data: policy,
  });
});

exports.updatePolicy = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { policyType, policyVersion, description } = req.body;

  // Validate required fields
  if (!policyType) {
    return next(new AppError('Please provide policyType', 400));
  }

  if (!policyVersion) {
    return next(new AppError('Please provide policyVersion', 400));
  }

  // Find the existing policy
  const existingPolicy = await Policy.findById(id);
  if (!existingPolicy) {
    return next(new AppError('Policy not found', 404));
  }

  let filename = existingPolicy.file;

  if (req.file) {
    const file = req.file;
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    filename = `${policyType}-${timestamp}${fileExtension}`;

    // Validate file type
    if (!['.pdf'].includes(fileExtension)) {
      return next(new AppError('Unsupported file type', 400));
    }

    const filePath = path.join('public/policies', filename);

    // Delete the old file if it exists
    if (existingPolicy.file) {
      const oldFilePath = path.join('public/policies', existingPolicy.file);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Save the new file to the filesystem
    await fs.promises.writeFile(filePath, file.buffer);
  }

  // Update the policy in the database
  existingPolicy.policyType = policyType;
  existingPolicy.policyVersion = policyVersion;
  existingPolicy.file = filename;
  existingPolicy.description = description;
  await existingPolicy.save();

  // Notification To Employees

  res.status(200).json({
    status: 'success',
    message: 'Policy updated successfully',
    data: existingPolicy,
  });
});

exports.getAllPolicies = catchAsync(async (req, res, next) => {
  const policies = await Policy.find();

  res.status(200).json({
    status: 'success',
    results: policies.length,
    data: policies,
  });
});

exports.deletePolicies = catchAsync(async (req,res,next) => {
  const { id } = req.params
  const policy = await Policy.findByIdAndDelete(id);
  if (!policy) {
    return next(new AppError('No policy found with that ID', 404));
  }
  res.status(204).json({ status: 'success', message: 'Policy deleted successfully' });
})

