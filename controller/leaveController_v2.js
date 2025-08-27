const LeaveApprovalHelper = require('../utills/leaveApprovalHelper');
const LeaveRequest = require('../model/leave_model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');

// Example controller showing how to use the new leave approval system with Admin role

exports.createLeaveRequest = catchAsync(async (req, res, next) => {
  const { fromDate, toDate, reason, leaveType, isEmergency = false } = req.body;
  const employeeId = req.user.id; // From auth middleware

  // Validate dates
  const validationErrors = LeaveApprovalHelper.validateLeaveDates(fromDate, toDate, employeeId);
  if (validationErrors.length > 0) {
    return next(new AppError(validationErrors.join(', '), 400));
  }

  // Create leave request with proper hierarchy
  const leaveRequest = await LeaveApprovalHelper.createLeaveRequest({
    employeeId,
    fromDate: new Date(fromDate),
    toDate: new Date(toDate),
    reason,
    leaveType,
    isEmergency,
    priority: isEmergency ? 'urgent' : 'medium',
  });

  res.status(201).json({
    status: 'success',
    data: {
      leaveRequest,
    },
  });
});

exports.getMyLeaveRequests = catchAsync(async (req, res, next) => {
  const employeeId = req.user.id;
  const leaves = await LeaveRequest.findByEmployee(employeeId);

  res.status(200).json({
    status: 'success',
    results: leaves.length,
    data: {
      leaves,
    },
  });
});

exports.getPendingApprovals = catchAsync(async (req, res, next) => {
  const approverId = req.user.id;
  const pendingLeaves = await LeaveApprovalHelper.getPendingApprovals(approverId);

  res.status(200).json({
    status: 'success',
    results: pendingLeaves.length,
    data: {
      leaves: pendingLeaves,
    },
  });
});

exports.approveLeaveRequest = catchAsync(async (req, res, next) => {
  const { leaveId } = req.params;
  const { comment } = req.body;
  const approverId = req.user.id;

  const leaveRequest = await LeaveApprovalHelper.processApproval(
    leaveId,
    approverId,
    'approve',
    comment
  );

  res.status(200).json({
    status: 'success',
    message: 'Leave request approved successfully',
    data: {
      leaveRequest,
    },
  });
});

exports.rejectLeaveRequest = catchAsync(async (req, res, next) => {
  const { leaveId } = req.params;
  const { comment } = req.body;
  const approverId = req.user.id;

  const leaveRequest = await LeaveApprovalHelper.processApproval(
    leaveId,
    approverId,
    'reject',
    comment
  );

  res.status(200).json({
    status: 'success',
    message: 'Leave request rejected',
    data: {
      leaveRequest,
    },
  });
});

// Admin Override Functions
exports.adminOverrideApprove = catchAsync(async (req, res, next) => {
  const { leaveId } = req.params;
  const { comment } = req.body;
  const adminId = req.user.id;

  // Check if user is admin
  const canOverride = await LeaveApprovalHelper.canPerformAdminOverride(adminId);
  if (!canOverride) {
    return next(new AppError('Only admin can perform override actions', 403));
  }

  const leaveRequest = await LeaveApprovalHelper.adminOverride(
    leaveId,
    adminId,
    'approve',
    comment
  );

  res.status(200).json({
    status: 'success',
    message: 'Leave request approved by admin override',
    data: {
      leaveRequest,
    },
  });
});

exports.adminOverrideReject = catchAsync(async (req, res, next) => {
  const { leaveId } = req.params;
  const { comment } = req.body;
  const adminId = req.user.id;

  // Check if user is admin
  const canOverride = await LeaveApprovalHelper.canPerformAdminOverride(adminId);
  if (!canOverride) {
    return next(new AppError('Only admin can perform override actions', 403));
  }

  const leaveRequest = await LeaveApprovalHelper.adminOverride(
    leaveId,
    adminId,
    'reject',
    comment
  );

  res.status(200).json({
    status: 'success',
    message: 'Leave request rejected by admin override',
    data: {
      leaveRequest,
    },
  });
});

exports.cancelLeaveRequest = catchAsync(async (req, res, next) => {
  const { leaveId } = req.params;
  const employeeId = req.user.id;

  const leaveRequest = await LeaveApprovalHelper.cancelLeaveRequest(leaveId, employeeId);

  res.status(200).json({
    status: 'success',
    message: 'Leave request cancelled successfully',
    data: {
      leaveRequest,
    },
  });
});

exports.getLeaveStatistics = catchAsync(async (req, res, next) => {
  const employeeId = req.user.id;
  const stats = await LeaveApprovalHelper.getLeaveStatistics(employeeId);

  res.status(200).json({
    status: 'success',
    data: {
      statistics: stats,
    },
  });
});

exports.addComment = catchAsync(async (req, res, next) => {
  const { leaveId } = req.params;
  const { text, isInternal = false } = req.body;
  const userId = req.user.id;
  const userName = req.user.name;
  const userRole = req.user.role;

  const leaveRequest = await LeaveRequest.findById(leaveId);
  if (!leaveRequest) {
    return next(new AppError('Leave request not found', 404));
  }

  await leaveRequest.addComment(userId, userName, userRole, text, isInternal);

  res.status(200).json({
    status: 'success',
    message: 'Comment added successfully',
    data: {
      leaveRequest,
    },
  });
});

exports.getLeaveRequestById = catchAsync(async (req, res, next) => {
  const { leaveId } = req.params;
  const userId = req.user.id;

  const leaveRequest = await LeaveRequest.findById(leaveId);
  if (!leaveRequest) {
    return next(new AppError('Leave request not found', 404));
  }

  // Check if user has access to this leave request
  const isOwner = leaveRequest.employeeId.equals(userId);
  const isApprover = leaveRequest.approvals.teamLead.id?.equals(userId) ||
                     leaveRequest.approvals.manager.id?.equals(userId) ||
                     leaveRequest.approvals.hr.id?.equals(userId) ||
                     leaveRequest.approvals.admin.id?.equals(userId);

  if (!isOwner && !isApprover && req.user.role !== 'admin') {
    return next(new AppError('You do not have access to this leave request', 403));
  }

  res.status(200).json({
    status: 'success',
    data: {
      leaveRequest,
    },
  });
});

// Admin Functions
exports.getAllLeaveRequests = catchAsync(async (req, res, next) => {
  const { status, department, fromDate, toDate, page = 1, limit = 10 } = req.query;
  const adminId = req.user.id;

  // Check if user is admin
  const canOverride = await LeaveApprovalHelper.canPerformAdminOverride(adminId);
  if (!canOverride) {
    return next(new AppError('Only admin can access all leave requests', 403));
  }

  const filters = {};
  if (status) filters.status = status;
  if (department) filters.department = department;
  if (fromDate && toDate) {
    filters.fromDate = fromDate;
    filters.toDate = toDate;
  }

  const leaves = await LeaveApprovalHelper.getAllLeavesForAdmin(adminId, filters);

  const skip = (page - 1) * limit;
  const paginatedLeaves = leaves.slice(skip, skip + parseInt(limit));

  res.status(200).json({
    status: 'success',
    results: paginatedLeaves.length,
    pagination: {
      current: parseInt(page),
      total: Math.ceil(leaves.length / limit),
      hasNext: skip + paginatedLeaves.length < leaves.length,
      hasPrev: page > 1,
    },
    data: {
      leaves: paginatedLeaves,
    },
  });
});

// Admin Dashboard Statistics
exports.getAdminDashboardStats = catchAsync(async (req, res, next) => {
  const adminId = req.user.id;

  // Check if user is admin
  const canOverride = await LeaveApprovalHelper.canPerformAdminOverride(adminId);
  if (!canOverride) {
    return next(new AppError('Only admin can access dashboard statistics', 403));
  }

  const stats = await LeaveApprovalHelper.getAdminDashboardStats(adminId);

  res.status(200).json({
    status: 'success',
    data: {
      statistics: stats,
    },
  });
});

// Admin can see all leaves without pagination
exports.getAllLeavesForAdmin = catchAsync(async (req, res, next) => {
  const adminId = req.user.id;
  const { status, department, fromDate, toDate } = req.query;

  // Check if user is admin
  const canOverride = await LeaveApprovalHelper.canPerformAdminOverride(adminId);
  if (!canOverride) {
    return next(new AppError('Only admin can access all leave requests', 403));
  }

  const filters = {};
  if (status) filters.status = status;
  if (department) filters.department = department;
  if (fromDate && toDate) {
    filters.fromDate = fromDate;
    filters.toDate = toDate;
  }

  const leaves = await LeaveApprovalHelper.getAllLeavesForAdmin(adminId, filters);

  res.status(200).json({
    status: 'success',
    results: leaves.length,
    data: {
      leaves,
    },
  });
});

// Admin can get any leave request by ID
exports.getAnyLeaveRequestById = catchAsync(async (req, res, next) => {
  const { leaveId } = req.params;
  const adminId = req.user.id;

  // Check if user is admin
  const canOverride = await LeaveApprovalHelper.canPerformAdminOverride(adminId);
  if (!canOverride) {
    return next(new AppError('Only admin can access any leave request', 403));
  }

  const leaveRequest = await LeaveRequest.findById(leaveId);
  if (!leaveRequest) {
    return next(new AppError('Leave request not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      leaveRequest,
    },
  });
});

// Admin can add internal comments
exports.addAdminComment = catchAsync(async (req, res, next) => {
  const { leaveId } = req.params;
  const { text } = req.body;
  const adminId = req.user.id;
  const adminName = req.user.name;

  // Check if user is admin
  const canOverride = await LeaveApprovalHelper.canPerformAdminOverride(adminId);
  if (!canOverride) {
    return next(new AppError('Only admin can add internal comments', 403));
  }

  const leaveRequest = await LeaveRequest.findById(leaveId);
  if (!leaveRequest) {
    return next(new AppError('Leave request not found', 404));
  }

  await leaveRequest.addComment(adminId, adminName, 'admin', text, true); // isInternal = true

  res.status(200).json({
    status: 'success',
    message: 'Admin comment added successfully',
    data: {
      leaveRequest,
    },
  });
}); 