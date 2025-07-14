const mongoose = require('mongoose');

const paySlipSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  employeeName: { type: String, required: true },
  salaryMonth: { type: String, required: true },
  salaryYear: { type: Number, required: true },
  basicWage: { type: Number, default: 0 },
  HRA: { type: Number, default: 0 },
  conveyanceAllowance: { type: Number, default: 0 },
  medicalAllowance: { type: Number, default: 0 },
  otherAllowance: [{
    fieldName: { type: String },
    value: { type: Number }
 }],
  EPF: { type: Number, default: 0 },
  tds: { type: Number, default: 0 },
  ESI_HealthInsurance: { type: Number, default: 0 },
  professionalTax: { type: Number, default: 0 },
  loanRecovery: { type: Number, default: 0 },
  leaveDeductionAmount: { type: Number, default: 0 },
  totalEarning: { type: Number, default: 0 },
  totalDeduction: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, default: null },

}, { timestamps: true });

module.exports = mongoose.model('PaySlip', paySlipSchema);
