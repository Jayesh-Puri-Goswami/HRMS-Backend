const Resignation = require('../model/resignation.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const moment = require('moment');

exports.createOrUpdateResignation = catchAsync(async (req, res, next) => {
  const { reason } = req.body;

  if (!reason) {
    return next(new AppError('Reason for resignation is required.', 400));
  }

  const employee = await Employee.findById(req.user._id);
  if (!employee) {
    return next(new AppError('Employee not found!', 404));
  }

  let resignation = await Resignation.findOne({ employeeId: req.user._id });

  if (resignation) {
    if (resignation.status === 'pending') {
      resignation.reason = reason;
      await resignation.save();

      return res.status(200).json({
        status: 'success',
        message: 'Resignation request updated successfully.',
        data: resignation,
      });
    } else {
      return next(
        new AppError(
          'Your resignation request has already been processed.',
          400
        )
      );
    }
  }

  // If no resignation request exists, create a new one
  resignation = await Resignation.create({
    employeeId: req.user._id,
    reason,
  });

  res.status(201).json({
    status: 'success',
    message: 'Resignation request submitted successfully.',
    data: resignation,
  });
});
