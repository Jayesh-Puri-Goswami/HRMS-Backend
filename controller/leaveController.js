const leavesModel = require('../model/leaves.model');
const Employee = require('../model/admin.model');
const holidaysModel = require('../model/holidays.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const employedLeave = require('../model/employeePaidLeave.model');
const moment = require('moment');
const Notification = require('../model/notification.model');
const sendNotification = require('../utills/notificationHelper');

exports.getEmployeeLeaveRequest = catchAsync(async (req, res) => {
  const { month, year } = req.query; // Extract month and year from the query parameters
  const employeeId = req.user._id; // Extract the employeeId from the query parameters

  let searchMonth;
  let nextMonth;
  let filter = {
    employeeId, // Use the employeeId for filtering
  };

  // Check if year and month are provided and have a valid format
  if (year && month && moment(`${year}-${month}`, 'YYYY-M').isValid()) {
    searchMonth = moment(`${year}-${month}`, 'YYYY-M').toDate();
    nextMonth = moment(searchMonth).add(1, 'month').toDate(); // Move to the next month

    // Add filtering based on fromDate and toDate if year and month are provided
    filter.fromDate = { $gte: searchMonth, $lt: nextMonth };
  }

  // Pagination options
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;

  try {
    let totalLeavesCount;

    if (filter.fromDate) {
      // Count total leaves for the employee in the specified month (without pagination)
      totalLeavesCount = await leavesModel.countDocuments(filter);
    } else {
      // Count total leaves for the employee (without filtering)
      totalLeavesCount = await leavesModel.countDocuments({ employeeId });
    }

    // Apply pagination to the query if filtering is not applied
    const leaves = await leavesModel
      .find(filter)
      .sort({ fromDate: -1 })
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

exports.getLeaveRequestById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const employeeId = req.user._id;

  try {
    const leaveRequest = await leavesModel.findOne({ _id: id, employeeId });
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    res.json({ data: leaveRequest });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

exports.updateLeaveRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { employeeId } = req.user._id;
  const { applyDate, fromDate, toDate, halfDay, leaveType, reason } = req.body;

  try {
    const leaveRequest = await leavesModel.findById(id, employeeId);
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    leaveRequest.applyDate = applyDate;
    leaveRequest.fromDate = fromDate;
    leaveRequest.toDate = toDate;
    leaveRequest.halfDay = halfDay;
    leaveRequest.leaveType = leaveType;
    leaveRequest.reason = reason;

    const updatedLeaveRequest = await leaveRequest.save();

    res.json({ data: updatedLeaveRequest });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

exports.deleteLeaveRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const employeeId = req.user._id;

  try {
    const leaveRequest = await leavesModel.findOneAndDelete({
      _id: id,
      employeeId,
    });
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    res.json({ message: 'Leave request deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

exports.getAllEmployeePendingLeaveRequests = catchAsync(async (req, res) => {
  const { employeeName, month, year, status } = req.query;
  let searchMonth;
  let nextMonth;

  const userId = req.user._id;
  const userRole = req.user.role;

  // Filter for leave requests assigned to the current user by their role
  let filter = {};
  if (userRole === 'Management') {
    filter.managerId = userId;
  } else if (userRole === 'TeamLead') {
    filter.teamLeadId = userId;
  } else {
    return res.status(403).json({ message: 'Unauthorized role for fetching leave requests' });
  }

  // Check if year and month are provided and have a valid format
  if (year && month && moment(`${year}-${month}`, 'YYYY-M').isValid()) {
    searchMonth = moment(`${year}-${month}`, 'YYYY-M').toDate();
    nextMonth = moment(searchMonth).add(1, 'month').toDate(); // Move to the next month

    filter.fromDate = { $gte: searchMonth, $lt: nextMonth };
  }

  if (employeeName) {
    filter.employeeName = employeeName;
  }

  if (status) {
    filter.status = status;
  }

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;

  try {
    const totalLeavesCount = await leavesModel.countDocuments(filter);

    const leaves = await leavesModel
      .find(filter)
      .sort({ fromDate: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate('managerId', 'name email')
      .populate('teamLeadId', 'name email')
      .populate('employeeId', 'name email')

    res.json({
      status: 'success',
      data: leaves,
      currentPage: page,
      totalPages: Math.ceil(totalLeavesCount / pageSize),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

exports.leaveRequest = catchAsync(async (req, res, next) => {
  const { applyDate, fromDate, toDate, halfDay, reason } = req.body;

  const holidays = await holidaysModel.find();

  // Get the employee data
  const employeeInformation = await Employee.findById(req.user._id);
  if (!employeeInformation) {
    return next(new AppError('Employee not found!', 404));
  }

  // Calculate the time an employee has spent in the company
  const joinDate = moment(employeeInformation.joinDate);
  const currentDate = moment();
  const employmentDuration = currentDate.diff(joinDate, 'years');

  const leaveRequest = new leavesModel({
    employeeId: req.user._id,
    employeeName: employeeInformation.name,
    applyDate,
    fromDate,
    toDate,
    halfDay,
    reason,
  });

  if (employeeInformation.manager) {
    leaveRequest.managerId = employeeInformation.manager;
    leaveRequest.managerStatus = 'pending';
  }

  if (employeeInformation.teamLead){
    leaveRequest.teamLeadId = employeeInformation.teamLead;
    leaveRequest.teamLeadStatus = 'pending'
  }

  const fromDate1 = moment(fromDate).startOf('day');
  const toDate1 = moment(toDate).startOf('day');

  // Check if there is any overlap with existing leave requests
  const overlappingLeaves = await leavesModel.find({
    employeeId: req.user.id,
    status: { $in: ['pending'] },
    $or: [
      { fromDate: { $gte: fromDate, $lte: toDate } },
      { toDate: { $gte: fromDate, $lte: toDate } },
      { fromDate: { $lte: fromDate }, toDate: { $gte: toDate } },
    ],
  });

  if (overlappingLeaves.length > 0) {
    return next(
      new AppError(
        'The requested leave dates overlap with existing leave requests.',
        400
      )
    );
  }

  // Calculate actual leave days
  function calculateActualLeave(fromDate1, toDate1, holidays) {
    const oneDay = 24 * 60 * 60 * 1000;
    const start = moment(fromDate1).startOf('day');
    const end = moment(toDate1).startOf('day');
    let totalDays = end.diff(start, 'days') + 1;
    let actualLeaveDays = totalDays;

    const leaveDetails = [];

    if (halfDay && fromDate1.isSame(toDate1)) {
      actualLeaveDays = 0.5;
      totalDays = 0.5;
      leaveDetails.push({
        date: start.format('YYYY-MM-DD'),
        halfDay: true,
      });
    } else {
      for (let i = 0; i < totalDays; i++) {
        const currentDate = moment(start)
          .add(i, 'days')
          .startOf('day')
          .toDate();
        const dayOfWeek = moment(currentDate).day();

        const currentDateFormatted = moment(currentDate).format('YYYY-MM-DD');
        const isHoliday = holidays.some((holiday) => {
          const holidayFromDate = moment(holiday.fromDate).format('YYYY-MM-DD');
          const holidayToDate = moment(holiday.toDate).format('YYYY-MM-DD');
          return (
            currentDateFormatted >= holidayFromDate &&
            currentDateFormatted <= holidayToDate
          );
        });

        if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
          actualLeaveDays--;
          leaveDetails.push({
            date: currentDateFormatted,
          });
        } else {
          leaveDetails.push({
            date: currentDateFormatted,
          });
        }
      }
    }

    leaveRequest.leaveDetails = leaveDetails;
    leaveRequest.totalLeaveDays = totalDays;

    return actualLeaveDays;
  }

  const actualLeaveDays = calculateActualLeave(fromDate1, toDate1, holidays);

  leaveRequest.actualLeaveDays = actualLeaveDays;

  // Save the leave request to the database
  await leaveRequest.save();

  if (employeeInformation.manager) {
    await Notification.create({
      userId: employeeInformation.manager,
      title: 'Leave Request',
      message: `New leave request from ${employeeInformation.name} from ${fromDate} to ${toDate}.`,
      type: 'info',
    });
  }

  // Send a response back to the employee
  return res.status(201).json({
    status: 'success',
    message: 'Leave request submitted successfully.',
    data: leaveRequest,
  });
});



//------------------------ For Admin ----------------------------//

exports.deleteLeaveRequestForAdmin = catchAsync(async (req, res) => {
  const { id } = req.params;
  try {
    const leaveRequest = await leavesModel.findOneAndDelete({ _id: id });
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    res.json({ message: 'Leave request deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


exports.getAllEmployeeLeaveRequests = catchAsync(async (req, res) => {
  const { employeeName, month, year, status } = req.query;
  let searchMonth;
  let nextMonth;
  let filter = {};

  // Check if year and month are provided and have a valid format
  if (year && month && moment(`${year}-${month}`, 'YYYY-M').isValid()) {
    searchMonth = moment(`${year}-${month}`, 'YYYY-M').toDate();
    nextMonth = moment(searchMonth).add(1, 'month').toDate(); // Move to the next month

    // Add filtering based on fromDate and toDate if year and month are provided
    filter.fromDate = { $gte: searchMonth, $lt: nextMonth };
  }

  // Check if employeeName is provided and add it to the filter
  if (employeeName) {
    filter.employeeName = employeeName;
  }

  if (status) {
    filter.status = status;
  }

  // Pagination options
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;

  try {
    let totalLeavesCount = await leavesModel.countDocuments(filter);

    // Use aggregation for custom sorting
    const leaves = await leavesModel.aggregate([
      { $match: filter },
      {
        $addFields: {
          sortOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'pending'] }, then: 1 },
                { case: { $eq: ['$status', 'approved'] }, then: 2 },
                { case: { $eq: ['$status', 'rejected'] }, then: 3 },
                { case: { $eq: ['$status', 'unapproved'] }, then: 4 },
              ],
              default: 5, // Default case for unexpected values
            },
          },
        },
      },
      { $sort: { sortOrder: 1, fromDate: -1 } }, // Sort by status priority, then fromDate descending
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
      { $project: { sortOrder: 0 } }, // Remove temporary sort field
    ]);

    // Modify the response to include managerApprovalPending logic
    const updatedLeaves = leaves.map((leave) => ({
      ...leave,
      managerApprovalPending:
        leave.managerId && leave.managerStatus === 'pending',
    }));

    res.json({
      data: updatedLeaves,
      currentPage: page,
      totalPages: Math.ceil(totalLeavesCount / pageSize),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Update the leave request
exports.updateLeaveRequestAdmin = catchAsync(async (req, res, next) => {
  const requestId = req.params.id;
  const adminName = req.user.name;
  const { leaveDetails, updateLeaveBalance } = req.body;

  // Validate leaveDetails array
  if (!Array.isArray(leaveDetails) || leaveDetails.length === 0) {
    return res.status(400).json({ message: 'Invalid or empty leaveDetails' });
  }

  try {
    const leaveRequest = await leavesModel.findById(requestId);
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Loop through leaveDetails and update leaveType and deductionType
    leaveRequest.leaveDetails.forEach((detail) => {
      const updatedDetail = leaveDetails.find(
        (newDetail) => newDetail._id.toString() === detail._id.toString()
      );

      if (updatedDetail) {
        const previousLeaveType = detail.leaveType;
        detail.leaveType = updatedDetail.leaveType || detail.leaveType;
        detail.deductionType =
          updatedDetail.deductionType || detail.deductionType;
      }
    });

    // Update Leave Balance And Approve The Request

    const employeeLeaveBalance = await employedLeave.findOne({
      employeeId: leaveRequest.employeeId,
    });
    if (!employeeLeaveBalance) {
      return next(new AppError('Employee leave balance not found!', 404));
    }

    // Aggregate requested leave counts by type, considering halfDay
    const leaveTypeCounts = leaveRequest.leaveDetails.reduce((acc, detail) => {
      if (detail.halfDay) {
        acc[detail.leaveType] = (acc[detail.leaveType] || 0) + 0.5;
      } else {
        acc[detail.leaveType] = (acc[detail.leaveType] || 0) + 1;
      }
      return acc;
    }, {});

    // Validate leave balance for each type
    for (const [leaveType, count] of Object.entries(leaveTypeCounts)) {
      if (
        (leaveType === 'casual' && employeeLeaveBalance.casualLeave < count) ||
        (leaveType === 'personal' &&
          employeeLeaveBalance.personalLeave < count) ||
        (leaveType === 'medical' && employeeLeaveBalance.medicalLeave < count)
      ) {
        return next(
          new AppError(
            `Insufficient ${leaveType} leave balance. Requested: ${count}, Available: ${
              employeeLeaveBalance[`${leaveType}Leave`]
            }`,
            400
          )
        );
      }
    }

    // Deduct leave balance for each type
    for (const [leaveType, count] of Object.entries(leaveTypeCounts)) {
      if (leaveType === 'casual') {
        employeeLeaveBalance.casualLeave -= count;
      } else if (leaveType === 'personal') {
        employeeLeaveBalance.personalLeave -= count;
      } else if (leaveType === 'medical') {
        employeeLeaveBalance.medicalLeave -= count;
      }
    }

    // Save the updated leave balance
    await employeeLeaveBalance.save();

    // Set the status to 'approved'
    leaveRequest.status = 'approved';
    leaveRequest.approvedBy = req.user.id;
    leaveRequest.approvedByName = req.user.name;

    // Save the updated leaveRequest
    await leaveRequest.save();

    res.status(200).json({
      message: 'Leave request updated successfully',
      data: leaveRequest,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

exports.leaveRequestActionAdmin = catchAsync(async (req, res, next) => {
  const requestId = req.params.id;
  const { action } = req.body;
  const adminName = req.user.name;

  try {
    const leaveRequest = await leavesModel.findById(requestId);
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (action === 'approve') {
      // Update Employee Leave Balance
      const employeeLeaveBalance = await employedLeave.findOne({
        employeeId: leaveRequest.employeeId,
      });
      if (!employeeLeaveBalance) {
        return next(new AppError('Employee leave balance not found!', 404));
      }

      // Aggregate requested leave counts by type
      const leaveTypeCounts = leaveRequest.leaveDetails.reduce(
        (acc, detail) => {
          acc[detail.leaveType] = (acc[detail.leaveType] || 0) + 1;
          return acc;
        },
        {}
      );

      // Validate leave balance for each type
      for (const [leaveType, count] of Object.entries(leaveTypeCounts)) {
        if (
          (leaveType === 'casual' &&
            employeeLeaveBalance.casualLeave < count) ||
          (leaveType === 'personal' &&
            employeeLeaveBalance.personalLeave < count) ||
          (leaveType === 'medical' && employeeLeaveBalance.medicalLeave < count)
        ) {
          return next(
            new AppError(
              `Insufficient ${leaveType} leave balance. Requested: ${count}, Available: ${
                employeeLeaveBalance[`${leaveType}Leave`]
              }`,
              400
            )
          );
        }
      }

      // Deduct leave balance for each type
      for (const [leaveType, count] of Object.entries(leaveTypeCounts)) {
        if (leaveType === 'casual') {
          employeeLeaveBalance.casualLeave -= count;
        } else if (leaveType === 'personal') {
          employeeLeaveBalance.personalLeave -= count;
        } else if (leaveType === 'medical') {
          employeeLeaveBalance.medicalLeave -= count;
        }
      }

      // Save the updated leave balance
      await employeeLeaveBalance.save();

      // Set the status to 'approved'
      leaveRequest.status = 'approved';
      leaveRequest.approvedBy = req.user.id;
      leaveRequest.approvedByName = adminName;

      // Save the updated leave request
      await leaveRequest.save();

      // Leave Notification
      await sendNotification({
        userId: leaveRequest.employeeId,
        title: 'Leave Request',
        message: `Your Leave Request Approved By Manager`,
        type: 'success',
      });

      res.status(200).json({
        message: 'Leave request approved successfully',
        data: leaveRequest,
      });
    } else if (action === 'reject') {
      // Set the status to 'rejected'
      leaveRequest.status = 'rejected';
      leaveRequest.approvedBy = req.user.id;
      leaveRequest.approvedByName = adminName;

      // Save the updated leave request
      await leaveRequest.save();

      res.status(200).json({
        message: 'Leave request rejected successfully.',
        data: leaveRequest,
      });
    } else {
      // Invalid action
      return res.status(400).json({
        message:
          'Invalid action. Please provide valid action (approve/reject/unapprove)',
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

exports.manageLeaveRequest = catchAsync(async (req, res, next) => {
  const requestId = req.params.id; // Extract the leave request ID from the URL parameters
  const { action } = req.body; // Extract the action (approve or reject) from the request body
  const adminName = req.user.name; // Assuming you have the admin's name in req.user.name

  try {
    const leaveRequest = await leavesModel.findById(requestId);
    if (!leaveRequest) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    // if (leaveRequest.status !== 'pending' || leaveRequest.status !== 'approved') {
    //   return next(new AppError('Action already taken!', 404));
    // }
    if (action === 'approve') {
      const employeeId = leaveRequest.employeeId.toString();

      let employeeLeaveData = await employedLeave.findOne({ employeeId });
      if (!employeeLeaveData) {
        return next(new AppError('EmployeeLeave Data not found!', 404));
      }

      const employeeInformation = await Employee.findById(employeeId);
      if (!employeeInformation) {
        return next(new AppError('Employee not found!', 404));
      }

      const leaveType = leaveRequest.leaveType;
      const leaveDays = leaveRequest.leaveDays;

      // Approve The Request
      // Switch case according to leave request for additional logic
      // switch (leaveType) {
      //   case 'Casual':
      //     break;

      //   case 'Personal':
      //     break;

      //   case 'Medical':
      //     break;

      //   default:
      //     return next(new AppError('Invalid leave type!', 400));
      // }

      // Set the status to 'approved'
      leaveRequest.status = 'approved';
      leaveRequest.approvedBy = req.user.id;
      leaveRequest.approvedByName = adminName;

      // Save the updated leave request
      await leaveRequest.save();
      await employeeLeaveData.save();

      res.status(200).json({
        message: 'Leave request approved successfully',
        data: leaveRequest,
      });
    } else if (action === 'unapprove') {
      const employeeId = leaveRequest.employeeId.toString();

      let employeeLeaveData = await employedLeave.findOne({ employeeId });
      if (!employeeLeaveData) {
        return next(new AppError('EmployeeLeave Data not found!', 404));
      }

      const employeeInformation = await Employee.findById(employeeId);
      if (!employeeInformation) {
        return next(new AppError('Employee not found!', 404));
      }

      const leaveType = leaveRequest.leaveType;
      const leaveDays = leaveRequest.leaveDays;

      // Approve The Request
      // Switch case according to leave request for additional logic
      // switch (leaveType) {
      //   case 'Casual':
      //     break;

      //   case 'Personal':
      //     break;

      //   case 'Medical':
      //     break;

      //   default:
      //     return next(new AppError('Invalid leave type!', 400));
      // }

      // Set the status to 'approved'
      leaveRequest.status = 'unapproved';
      leaveRequest.approvedBy = req.user.id;
      leaveRequest.approvedByName = adminName;

      // Save the updated leave request
      await leaveRequest.save();
      await employeeLeaveData.save();

      res.status(200).json({
        message: 'Leave request unapproved successfully',
        data: leaveRequest,
      });
    } else if (action === 'reject') {
      // Revert the leave balance in case of rejection
      const employeeId = leaveRequest.employeeId.toString();

      let employeeLeaveData = await employedLeave.findOne({ employeeId });
      if (!employeeLeaveData) {
        return next(new AppError('Employee leave data not found!', 404));
      }

      const leaveType = leaveRequest.leaveType;
      const leaveDays = leaveRequest.leaveDays;

      // // Revert the leave balance based on the leave type
      // switch (leaveType) {
      //   case 'casual':
      //     employeeLeaveData.casualLeave += leaveDays;
      //     break;

      //   case 'personal':
      //     employeeLeaveData.personalLeave += leaveDays;
      //     break;

      //   case 'medical':
      //     employeeLeaveData.medicalLeave += leaveDays;
      //     break;

      //   default:
      //     return next(new AppError('Invalid leave type', 400));
      // }

      // // Save the updated leave balance
      // await employeeLeaveData.save();

      // Set the status to 'rejected'
      leaveRequest.status = 'rejected';
      leaveRequest.approvedBy = req.user.id;
      leaveRequest.approvedByName = adminName;

      // Save the updated leave request
      await leaveRequest.save();

      res.status(200).json({
        message: 'Leave request rejected successfully.',
        data: leaveRequest,
      });
    } else {
      // Invalid action
      return res.status(400).json({
        message:
          'Invalid action. Please provide valid action (approve/reject/unapprove)',
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single employee's leave request (for Admin and HR)

exports.getSingleEmployeeLeaveRequestAdmin = catchAsync(
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

exports.getEmployeeLeaveDetailsOfMonthAndYear = catchAsync(
  async (req, res, next) => {
    const { id } = req.params;
    const { month, year } = req.query;

    // Validate if month and year are provided
    if (!month || !year) {
      return next(new AppError('Month and Year are required', 400));
    }

    // Convert month name (e.g. "January") to its corresponding numeric value (0-11)
    const monthIndex = new Date(Date.parse(month + ' 1, 2025')).getMonth();
    if (isNaN(monthIndex)) {
      return next(new AppError('Invalid month name provided', 400));
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
      year: year, // Use the provided year
      casual: 0,
      personal: 0,
      medical: 0,
      LWP: 0,
    };

    // Get the start and end dates for the requested month and year
    const startOfMonth = new Date(year, monthIndex, 1); // Month is 0-based
    const endOfMonth = new Date(year, monthIndex + 1, 0); // Last day of the given month

    // Set the month name for the response
    leaveCountMonth.month = new Date(year, monthIndex).toLocaleString(
      'default',
      {
        month: 'long',
      }
    );

    // Fetch leave data for the provided month and year
    const leavesTakenInMonth = await leavesModel.find({
      employeeId: id,
      status: 'approved',
      applyDate: {
        $gte: startOfMonth, // Start of the requested month
        $lte: endOfMonth, // End of the requested month
      },
    });

    // Process monthly leave data considering halfDay
    leavesTakenInMonth.forEach((leave) => {
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

    const leavesTakenInYear = await leavesModel.find({
      employeeId: id,
      status: 'approved',
      applyDate: {
        $gte: financialYearStart, // Start of the requested year
        $lte: financialYearEnd, // End of the requested year
      },
    });

    // Process yearly leave data considering halfDay
    leavesTakenInYear.forEach((leave) => {
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
        leaveCountMonth,
        leaveCountYear,
      },
    });
  }
);



exports.employeesOnLeave = catchAsync(async (req, res) => {
  const { employeeName, month, year } = req.query;
  const managerId = req.user.id;

  let filter = {
    managerId: managerId,
    status: 'approved',
    fromDate: { $gte: moment().startOf('month').toDate() },
  };

  if (year && month && moment(`${year}-${month}`, 'YYYY-M').isValid()) {
    const searchMonth = moment(`${year}-${month}`, 'YYYY-M')
      .startOf('month')
      .toDate();
    const nextMonth = moment(searchMonth)
      .add(1, 'month')
      .startOf('month')
      .toDate();

    filter.fromDate = { $gte: searchMonth, $lt: nextMonth };
  }

  if (employeeName) {
    filter.employeeName = employeeName;
  }

  try {
    const leaves = await leavesModel.find(filter).sort({ fromDate: 1 }).populate("employeeId");

    res.json({
      status: 'success',
      data: leaves,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }

});