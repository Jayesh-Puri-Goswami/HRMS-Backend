const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    // Employee who applied for leave
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      employeeName: String,

    // Leave details
    leaveType: {
      type: String,
      enum: ['casual', 'personal', 'medical', 'LWP', 'none'],
      default: 'none',
    },
    applyDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    reason: { 
      type: String, 
      required: true,
      trim: true 
    },
    
    // Leave status and approval flow
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },

    // Approval hierarchy with Admin override
    approvals: {
      teamLead: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String },
        status: { 
          type: String, 
          enum: ['pending', 'approved', 'rejected', 'not_required'],
          default: 'pending'
        },
        comment: { type: String },
        date: { type: Date },
      },
      manager: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String },
        status: { 
          type: String, 
          enum: ['pending', 'approved', 'rejected', 'not_required'],
          default: 'pending'
        },
        comment: { type: String },
        date: { type: Date },
      },
      hr: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String },
        status: { 
          type: String, 
          enum: ['pending', 'approved', 'rejected', 'not_required'],
          default: 'pending'
        },
        comment: { type: String },
        date: { type: Date },
      },
      admin: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String },
        status: { 
          type: String, 
          enum: ['pending', 'approved', 'rejected', 'not_required'],
          default: 'not_required'
        },
        comment: { type: String },
        date: { type: Date },
        isOverride: { type: Boolean, default: false }, // Admin override flag
      },
    },

    // Leave calculation
    totalDays: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    actualDays: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    halfDay: {
      type: Boolean,
      default: false,
    },

    // Detailed leave breakdown
    leaveDetails: [
      {
        date: { type: Date, required: true },
        leaveType: {
          type: String,
          enum: ['casual', 'personal', 'medical', 'LWP', 'none'],
          default: 'none',
        },
        isHalfDay: { type: Boolean, default: false },
        isWorkingDay: { type: Boolean, default: true },
        deductionType: {
          type: Number, // 0=no deduction, 1=full day, 2=half day, 3=quarter day
          enum: [0, 1, 2, 3],
          default: 0,
        },
      },
    ],

    // Comments and history
    comments: [
      {
        user: {
          id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          name: { type: String },
          role: { type: String }, // employee, teamLead, manager, hr, admin
        },
        text: { type: String, required: true },
        date: { type: Date, default: Date.now },
        isInternal: { type: Boolean, default: false }, // HR/Admin only comments
      },
    ],

    // Additional metadata
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    isEmergency: { type: Boolean, default: false },
    attachments: [
      {
        filename: { type: String },
        originalName: { type: String },
        path: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      }
    ],

    // Audit fields
    createdBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
    },
    updatedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for current approval status
leaveSchema.virtual('currentStatus').get(function() {
  if (this.status === 'cancelled') return 'cancelled';
  if (this.status === 'rejected') return 'rejected';
  if (this.status === 'approved') return 'approved';
  
  // Check admin override first
  if (this.approvals.admin.status === 'approved') return 'approved_by_admin';
  if (this.approvals.admin.status === 'rejected') return 'rejected_by_admin';
  
  // Check approval flow
  if (this.approvals.teamLead.status === 'rejected') return 'rejected_by_teamlead';
  if (this.approvals.manager.status === 'rejected') return 'rejected_by_manager';
  if (this.approvals.hr.status === 'rejected') return 'rejected_by_hr';
  
  if (this.approvals.hr.status === 'approved') return 'approved';
  if (this.approvals.manager.status === 'approved') return 'pending_hr';
  if (this.approvals.teamLead.status === 'approved') return 'pending_manager';
  
  return 'pending_teamlead';
});

// Virtual for next approver
leaveSchema.virtual('nextApprover').get(function() {
  // Admin can always approve/reject
  if (this.approvals.admin.status === 'pending') return 'admin';
  
  if (this.approvals.teamLead.status === 'pending') return 'teamLead';
  if (this.approvals.manager.status === 'pending') return 'manager';
  if (this.approvals.hr.status === 'pending') return 'hr';
  return null;
});

// Virtual for admin override status
leaveSchema.virtual('hasAdminOverride').get(function() {
  return this.approvals.admin.isOverride === true;
});

// Indexes for better performance
leaveSchema.index({ 'employeeId': 1, 'status': 1 });
leaveSchema.index({ 'approvals.teamLead.id': 1, 'status': 1 });
leaveSchema.index({ 'approvals.manager.id': 1, 'status': 1 });
leaveSchema.index({ 'approvals.hr.id': 1, 'status': 1 });
leaveSchema.index({ 'approvals.admin.id': 1, 'status': 1 });
leaveSchema.index({ fromDate: 1, toDate: 1 });
leaveSchema.index({ createdAt: -1 });

// Pre-save middleware for validation
leaveSchema.pre('save', function (next) {
  // Validate dates
  if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
    return next(new Error('From Date cannot be later than To Date'));
  }

  // Auto-calculate total days if not set
  if (this.fromDate && this.toDate && !this.totalDays) {
    const diffTime = Math.abs(this.toDate - this.fromDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    this.totalDays = diffDays;
  }

  // Update approval status based on hierarchy
  // Admin override takes precedence
  if (this.approvals.admin.status === 'approved') {
    this.status = 'approved';
  } else if (this.approvals.admin.status === 'rejected') {
    this.status = 'rejected';
  } else if (this.approvals.teamLead.status === 'rejected' || 
             this.approvals.manager.status === 'rejected' || 
             this.approvals.hr.status === 'rejected') {
    this.status = 'rejected';
  } else if (this.approvals.hr.status === 'approved') {
    this.status = 'approved';
  }

  next();
});

// Instance methods
leaveSchema.methods.addComment = function(userId, userName, userRole, text, isInternal = false) {
  this.comments.push({
    user: { id: userId, name: userName, role: userRole },
    text,
    isInternal,
    date: new Date()
  });
  return this.save();
};

leaveSchema.methods.approve = function(approverId, approverName, approverRole, comment = '', isOverride = false) {
  const approvalKey = approverRole.toLowerCase();
  if (this.approvals[approvalKey]) {
    this.approvals[approvalKey] = {
      id: approverId,
      name: approverName,
      status: 'approved',
      comment,
      date: new Date(),
      ...(approverRole === 'admin' && { isOverride })
    };
  }
  return this.save();
};

leaveSchema.methods.reject = function(approverId, approverName, approverRole, comment = '', isOverride = false) {
  const approvalKey = approverRole.toLowerCase();
  if (this.approvals[approvalKey]) {
    this.approvals[approvalKey] = {
      id: approverId,
      name: approverName,
      status: 'rejected',
      comment,
      date: new Date(),
      ...(approverRole === 'admin' && { isOverride })
    };
  }
  this.status = 'rejected';
  return this.save();
};

// Admin override methods
leaveSchema.methods.adminOverride = function(adminId, adminName, action, comment = '') {
  this.approvals.admin = {
    id: adminId,
    name: adminName,
    status: action === 'approve' ? 'approved' : 'rejected',
    comment,
    date: new Date(),
    isOverride: true
  };
  
  if (action === 'approve') {
    this.status = 'approved';
  } else {
    this.status = 'rejected';
  }
  
  return this.save();
};

// Static methods
leaveSchema.statics.findByEmployee = function(employeeId) {
  return this.find({ employeeId }).sort({ createdAt: -1 });
};

leaveSchema.statics.findPendingApprovals = function(approverId, role) {
  const query = {};
  query[`approvals.${role}.id`] = approverId;
  query[`approvals.${role}.status`] = 'pending';
  return this.find(query).sort({ createdAt: -1 });
};

// Admin can see all leaves
leaveSchema.statics.findAllForAdmin = function() {
  return this.find().sort({ createdAt: -1 });
};

module.exports = mongoose.model('LeaveRequest', leaveSchema);
