const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeName: { type: String, required: true },
    date: Date,
    checkInTime: Date,
    checkOutTime: Date,
    totalHours: String,
    totalMinutes: { type: Number, default: 0 },
    leaveStatus: { type: String, default: null },
    pauses: [
      {
        pauseTime: Date,
        resumeTime: Date,
      },
    ],
    totalPausedMinutes: { type: Number, default: 0 },
    isPaused: { type: Boolean, default: false },
    lunchStart: Date,
    lunchEnd: Date,
    lunchMinutes: { type: Number, default: 0 },
    breakStart: Date,
    breakEnd: Date,
    breakMinutes: { type: Number, default: 0 },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    shiftStartTime: { type: String, default: null },
    shiftEndTime: { type: String, default: null },
    shiftLunchTime: { type: Number, default: 0 },
    shiftBreakTime: { type: Number, default: 0 },
    status: { type: String, default: null},
  },
  { timestamps: true }
);

module.exports = mongoose.model('Attendance', attendanceSchema);
