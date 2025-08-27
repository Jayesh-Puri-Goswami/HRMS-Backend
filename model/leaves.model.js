 const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeName: String,
    employeeLeaveType: {
      type: String,
      enum: ['casual', 'personal', 'medical', 'LWP', 'none'],
      default: 'none',
    },
    applyDate: {
      type: Date,
      required: true,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    reason: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'unapproved'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedByName: { type: String, default: null },
    // Manager Approval Fields
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    managerStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', ''],
      default: '',
    },
    teamLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    teamLeadStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    actualLeaveDays: { type: Number, default: 0 },
    totalLeaveDays: { type: Number, default: 0 },
    halfDay: {
      type: Boolean,
      default: false,
    },
    // Comments
    comments: [
      {
        commentBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: { type: String, default: null },
        commentText: { type: String },
        commentDate: { type: Date, default: Date.now },
      },
    ],
    // Array to manage leave details for individual dates
    leaveDetails: [
      {
        date: { type: Date, required: true },
        leaveType: {
          type: String,
          enum: ['casual', 'personal', 'medical', 'LWP', 'none'],
          default: 'none',
        },
        deductionType: {
          type: Number,
          enum: [0, 1, 2, 3],
          default: 0,
        },
        halfDay: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  { timestamps: true }
);

// Custom validation to ensure fromDate is before toDate
leaveSchema.pre('save', function (next) {
  if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
    return next(new Error('From Date cannot be later than To Date'));
  }
  next();
});

module.exports = mongoose.model('LeaveRequest', leaveSchema);
