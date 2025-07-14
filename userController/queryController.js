const PaySlip = require('../model/paySlip.model');
const Employee = require('../model/admin.model');
const Query = require('../model/query.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const moment = require('moment');

exports.createQuery = catchAsync(async (req, res, next) => {
  const { category, priority, description } = req.body;
  const employeeId = req.user.id;

  // Find an HR employee (assuming 'role' is a field in the Employee model)
  const hrEmployee = await Employee.findOne({ role: 'HR' });
  if (!hrEmployee) {
    return next(new AppError('No HR employee found to assign the query', 404));
  }

  const query = await Query.create({
    employeeId,
    category,
    priority: priority || 'Low',
    description,
    status: 'Open',
    assignedTo: hrEmployee._id,
  });

  if (!query) {
    return next(new AppError('Query creation failed!', 400));
  }

  res.status(201).json({
    message: 'Query created successfully',
    data: query,
  });
});

exports.getAllQueries = catchAsync(async (req, res, next) => {

  res.status(200).json("Hello");


});