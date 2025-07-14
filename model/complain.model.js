const mongoose = require('mongoose');

const EmployeeComplainSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  employeeName : {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Rejected', 'Resolved'],
    default: 'Pending',
  }

}, {timestamps : true});

module.exports = mongoose.model('Complain', EmployeeComplainSchema);