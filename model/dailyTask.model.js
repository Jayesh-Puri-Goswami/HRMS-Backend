// models/dailyTaskList.model.js
const mongoose = require('mongoose');

const dailyTaskListSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeName: { type: String, required: true },
    email: { type: String, required: true },
    designation: { type: String, default: null },
    department: { type: String, default: null },
    date: { type: Date, required: true },
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date, required: true },
    totalHours: { type: String, default: '0h:0m' },
    totalMinutes: { type: Number, default: 0 },
    tasks: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DailyTaskList', dailyTaskListSchema);
