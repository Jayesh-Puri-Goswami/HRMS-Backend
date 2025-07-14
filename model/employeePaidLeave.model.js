const mongoose = require('mongoose');

const employeeLeaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeName: { type: String, required: true },
    role: { type: String, required: true },
    casualLeave: { type: Number, default: 0 },
    personalLeave: { type: Number, default: 0 },
    medicalLeave: { type: Number, default: 0 },
    LWP: { type: Number, default: 0 }, // Add LWP field to track leave without pay days
  },
  { timestamps: true }
);

module.exports = mongoose.model('availableLeave', employeeLeaveSchema);




