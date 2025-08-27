const AvailableLeave = require('../model/employeePaidLeave.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const moment = require('moment');
const leavesModel = require('../model/leaves.model');

// Helper function to create or get employee leave balance
const getOrCreateEmployeeLeaveBalance = async (employeeId) => {
  let leaveBalance = await AvailableLeave.findOne({ employeeId });
  
  if (!leaveBalance) {
    // Create new leave balance record with default values
    leaveBalance = new AvailableLeave({
      employeeId,
      employeeName: 'Unknown', // Will be updated when employee data is available
      role: 'Employee',
      casualLeave: 0,
      personalLeave: 0,
      medicalLeave: 0,
      LWP: 0
    });
    await leaveBalance.save();
  }
  
  // Ensure LWP field exists
  if (leaveBalance.LWP === undefined) {
    leaveBalance.LWP = 0;
    await leaveBalance.save();
  }
  
  return leaveBalance;
};

// For Employee


exports.getEmployeePaidLeave = catchAsync(async (req, res) => {
  const employeeId = req.user._id;

  try {
    // Get or create employee's available leave balance
    const leaveData = await getOrCreateEmployeeLeaveBalance(employeeId);

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
        status: 'success',
        leaveBalance: leaveData,
        eligibleForSixPersonalLeaves: true,
        message: 'Employee leave balance retrieved successfully'
      });
    } else {
      res.json({
        status: 'success',
        leaveBalance: leaveData,
        eligibleForSixPersonalLeaves: false,
        message: 'Employee leave balance retrieved successfully'
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



// For Admin

exports.getEmployeePaidLeaveById = catchAsync(async (req, res) => {
    const employeeId = req.params.id;

    console.log(`Running getEmployeePaidLeaveById for employee:`, employeeId);
    
    try {
      // Get or create employee's available leave balance
      const leaveData = await getOrCreateEmployeeLeaveBalance(employeeId);
  
      res.json({
        status: 'success',
        data: leaveData,
        message: 'Employee leave balance retrieved successfully'
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

  exports.updateEmployeePaidLeaveById = catchAsync(async (req, res) => {
    const updateData = req.body; 
    
    // Ensure LWP field is included if not provided
    if (updateData.LWP === undefined) {
      updateData.LWP = 0;
    }
    
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

      // Ensure LWP field exists in response
      if (updatedLeaveData.LWP === undefined) {
        updatedLeaveData.LWP = 0;
      }
  
      res.json({
        status: 'success',
        data: updatedLeaveData,
        message: 'Employee leave balance updated successfully'
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create or initialize employee leave balance
  exports.createEmployeeLeaveBalance = catchAsync(async (req, res) => {
    const { employeeId, employeeName, role, casualLeave, personalLeave, medicalLeave, LWP } = req.body;
    
    try {
      // Check if employee leave balance already exists
      let existingBalance = await AvailableLeave.findOne({ employeeId });
      
      if (existingBalance) {
        return res.status(400).json({
          status: 'error',
          message: 'Employee leave balance already exists',
          data: existingBalance
        });
      }
      
      // Create new employee leave balance
      const newLeaveBalance = new AvailableLeave({
        employeeId,
        employeeName: employeeName || 'Unknown',
        role: role || 'Employee',
        casualLeave: casualLeave || 0,
        personalLeave: personalLeave || 0,
        medicalLeave: medicalLeave || 0,
        LWP: LWP || 0
      });
      
      const savedLeaveBalance = await newLeaveBalance.save();
      
      res.status(201).json({
        status: 'success',
        message: 'Employee leave balance created successfully',
        data: savedLeaveBalance
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Reset or update LWP count for an employee
  exports.resetLWPCount = catchAsync(async (req, res) => {
    const { employeeId } = req.params;
    const { LWP } = req.body;
    
    try {
      // Get or create employee leave balance
      const leaveBalance = await getOrCreateEmployeeLeaveBalance(employeeId);
      
      // Update LWP count
      leaveBalance.LWP = LWP || 0;
      await leaveBalance.save();
      
      res.json({
        status: 'success',
        message: 'LWP count updated successfully',
        data: leaveBalance
      });
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

    // Ensure LWP field exists for all employees
    const leavesWithLWP = leaves.map(leave => {
      if (leave.LWP === undefined) {
        leave.LWP = 0;
      }
      return leave;
    });

    res.json({
      status: 'success',
      data: leavesWithLWP,
      currentPage: page,
      totalPages: Math.ceil(totalLeavesCount / pageSize),
      message: 'All employee leave balances retrieved successfully'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
