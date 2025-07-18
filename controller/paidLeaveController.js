const AvailableLeave = require('../model/employeePaidLeave.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const moment = require('moment');
const leavesModel = require('../model/leaves.model');

// For Employee


exports.getEmployeePaidLeave = catchAsync(async (req, res) => {
  const employeeId = req.user._id;

  try {
    // Fetch employee's available leave balance
    const leaveData = await AvailableLeave.findOne({ employeeId });
    if (!leaveData) {
      return res
        .status(404)
        .json({ message: 'Leave data not found for the provided employeeId.' });
    }

    // Fetch employee details (to check the joining date)
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    // Check if the employee has completed 6 months from the joining date
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Convert joinDate string to Date object for comparison
    const joinDate = new Date(employee.joinDate);

    // Check if the employee has completed 6 months
    const isEligibleForSixPersonalLeaves = joinDate <= sixMonthsAgo;

    // Fetch personal leave requests to check if the employee has taken any
    const personalLeaveRequests = await leavesModel.find({
      employeeId,
      leaveType: 'personal',
      status: { $in: ['approved', 'unapproved'] },
    });

    const hasTakenPersonalLeave = personalLeaveRequests.length > 0;

    // Check if the employee has a personal leave balance of at least 6
    const hasSufficientLeaveBalance = leaveData.personalLeave >= 6;

    // Return the result based on the above checks
    if (
      isEligibleForSixPersonalLeaves &&
      !hasTakenPersonalLeave &&
      hasSufficientLeaveBalance
    ) {
      res.json({
        leaveBalance: leaveData,
        eligibleForSixPersonalLeaves: true,
      });
    } else {
      res.json({
        leaveBalance: leaveData,
        eligibleForSixPersonalLeaves: false,
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// For Admin

exports.getEmployeePaidLeaveById = catchAsync(async (req, res) => {
    const employeeId = req.params.id;
  
    try {
      const leaveData = await AvailableLeave.findOne({ employeeId });
  
      if (!leaveData) {
        return res
          .status(404)
          .json({ message: 'Leave data not found for the provided employeeId.' });
      }
  
      res.json(leaveData);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

  exports.updateEmployeePaidLeaveById = catchAsync(async (req, res) => {
    const updateData = req.body; 
    try {
      const updatedLeaveData = await AvailableLeave.findByIdAndUpdate(
        req.params.id, 
        { $set: updateData }, 
        { new: true, runValidators: true } 
      );
  
      if (!updatedLeaveData) {
        return res
          .status(404)
          .json({ message: 'Leave data not found for the provided employeeId.' });
      }
  
      res.json(updatedLeaveData);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  

exports.getAllEmployeePaidLeave = catchAsync(async (req, res) => {
  const { employeeName } = req.query;
  let filter = { role: { $in: ['Employee', 'Management'] } };

  if (employeeName) {
    filter.employeeName = employeeName;
  }

  // Pagination options
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;

  try {
    let totalLeavesCount;

    if (Object.keys(filter).length > 1) {
      // Count total leaves for the specified employee name and role (without pagination)
      totalLeavesCount = await AvailableLeave.countDocuments(filter);
    } else {
      // Count total leaves for all employees with role "Employee" (without filtering by name)
      totalLeavesCount = await AvailableLeave.countDocuments({
        role: 'Employee',
      });
    }

    // Apply pagination to the query if filtering is not applied
    const leaves = await AvailableLeave.find(filter)
      .sort({ createdAt: -1 }) // You can sort based on any property as required
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    res.json({
      data: leaves,
      currentPage: page,
      totalPages: Math.ceil(totalLeavesCount / pageSize),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
