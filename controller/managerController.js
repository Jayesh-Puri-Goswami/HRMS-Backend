const leavesModel = require('../model/leaves.model');
const Employee = require('../model/admin.model');
const holidaysModel = require('../model/holidays.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const employedLeave = require('../model/employeePaidLeave.model');
const moment = require('moment');
const APIFeatures = require('../utills/apiFeatures');
const AvailableLeave = require('../model/employeePaidLeave.model');
const sendNotification = require('../utills/notificationHelper');

exports.getAllAssignedEmployees = catchAsync(async (req, res, next) => {
  let filter = {};

  const userId = req.params.userId || req.user.id;

  // Filter for employees assigned to the manager or team lead
  filter.$or = [{ manager: userId }, { teamLead: userId }];

  const features = new APIFeatures(
    Employee.find(filter)
      .populate('manager', 'name email') // Populate manager details
      .populate('teamLead', 'name email'), // Populate teamLead details
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const employees = await features.query;

  console.log(employees);
  

  res.status(200).json({
    status: 'success',
    results: employees.length,
    data: {
      employees,
    },
  });
});

exports.getSingleEmployeeLeaveRequestManager = catchAsync(
  async (req, res, next) => {
    const { id } = req.params;

    // Fetch the leave data based on employee ID
    const employeeLeaveData = await leavesModel
      .findOne({ _id: id })
      .populate({
        path: 'employeeId',
        as: 'employeeData',
      })
      .populate({
        path: 'comments.commentBy',
        select: 'name email profile_image',
      });

    // If no leave data found, return an error
    if (!employeeLeaveData) {
      return next(
        new AppError('No leave request found for this employee', 404)
      );
    }

    // Initialize counters for monthly and yearly leave counts
    const leaveCountMonth = {
      month: '',
      casual: 0,
      personal: 0,
      medical: 0,
      LWP: 0,
    };

    const leaveCountYear = {
      year: new Date().getFullYear(),
      casual: 0,
      personal: 0,
      medical: 0,
      LWP: 0,
    };

    // Get the month from the employee's leave data
    const currentMonthIndex = new Date(employeeLeaveData.fromDate).getMonth(); // 0-11
    const currentYear = new Date().getFullYear();

    // Set the month name
    leaveCountMonth.month = new Date(
      currentYear,
      currentMonthIndex
    ).toLocaleString('default', {
      month: 'long',
    });

    // Fetch leave data for the current month
    const leavesTakenInCurrentMonth = await leavesModel.find({
      employeeId: employeeLeaveData.employeeId,
      status: 'approved',
      applyDate: {
        $gte: new Date(currentYear, currentMonthIndex, 1), // Start of current month
        $lte: new Date(currentYear, currentMonthIndex + 1, 0), // End of current month
      },
    });

    // Process monthly leave data considering halfDay
    leavesTakenInCurrentMonth.forEach((leave) => {
      leave.leaveDetails.forEach((leaveDetail) => {
        if (
          ['casual', 'personal', 'medical', 'LWP'].includes(
            leaveDetail.leaveType
          )
        ) {
          if (leaveDetail.halfDay) {
            leaveCountMonth[leaveDetail.leaveType] += 0.5; // Add half day
          } else {
            leaveCountMonth[leaveDetail.leaveType] += 1; // Add full day
          }
        }
      });
    });

    // Calculate leave data for the financial year (April to March)
    const currentDate = new Date();
    let financialYearStart, financialYearEnd;

    if (currentDate.getMonth() >= 3) {
      financialYearStart = new Date(currentDate.getFullYear(), 3, 1);
      financialYearEnd = new Date(currentDate.getFullYear() + 1, 2, 31);
    } else {
      financialYearStart = new Date(currentDate.getFullYear() - 1, 3, 1);
      financialYearEnd = new Date(currentDate.getFullYear(), 2, 31);
    }

    // Fetch leave data for the financial year
    const leavesTakenInFinancialYear = await leavesModel.find({
      employeeId: employeeLeaveData.employeeId,
      status: 'approved',
      applyDate: {
        $gte: financialYearStart, // Start of financial year
        $lte: financialYearEnd, // End of financial year
      },
    });

    // Process financial year leave data considering halfDay
    leavesTakenInFinancialYear.forEach((leave) => {
      leave.leaveDetails.forEach((leaveDetail) => {
        if (
          ['casual', 'personal', 'medical', 'LWP'].includes(
            leaveDetail.leaveType
          )
        ) {
          if (leaveDetail.halfDay) {
            leaveCountYear[leaveDetail.leaveType] += 0.5; // Add half day
          } else {
            leaveCountYear[leaveDetail.leaveType] += 1; // Add full day
          }
        }
      });
    });

    // Send the response with the monthly and yearly leave counts
    res.json({
      status: 'success',
      data: {
        employeeLeaveData,
        leaveCountMonth,
        leaveCountYear,
      },
    });
  }
);

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

exports.performManagerLeaveAction = catchAsync(async (req, res, next) => {
  const requestId = req.params.id;
  const { action, comment } = req.body;
  const userId = req.user.id;
  const userName = req.user.name;
  const userRole = req.user.role;

  try {
    const leaveRequest = await leavesModel.findById(requestId);
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Convert frontend action to model enum
    const actionMapping = {
      Approve: 'approved',
      Reject: 'rejected',
    };

    const statusToSet = actionMapping[action];

    if (!statusToSet) {
      return res.status(400).json({
        message: 'Invalid action. Please provide a valid action (Approve/Reject)',
      });
    }

    // Update status based on role
    if (userRole === 'TeamLead') {
      leaveRequest.teamLeadStatus = statusToSet;
      leaveRequest.teamLeadId = userId;
    } else if (userRole === 'Management') {
      leaveRequest.managerStatus = statusToSet;
      leaveRequest.managerId = userId;
    } else {
      return res.status(403).json({ message: 'Unauthorized role' });
    }

    // Add comment
    if (comment) {
      leaveRequest.comments.push({
        commentBy: userId,
        commentText: comment,
        commentDate: new Date(),
      });
    }

    await leaveRequest.save();

    // Notification message
    await sendNotification({
      userId: leaveRequest.employeeId,
      title: 'Leave Request',
      message: `Your Leave Request ${statusToSet === 'approved' ? 'Approved' : 'Rejected'} By ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}`,
      type: statusToSet === 'approved' ? 'success' : 'error',
    });

    //'pending', 'approved', 'rejected'

    res.status(200).json({
      message: `Leave request ${statusToSet} successfully by ${userRole}`,
      data: leaveRequest,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


