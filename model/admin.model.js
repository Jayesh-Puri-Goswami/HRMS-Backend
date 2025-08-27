const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');


const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please tell us your name!'],
    },
    org: {
      type: String,
      required: true,
      enum: ['CSL', 'Upthrust', 'TechyMAU'],
      default: 'CSL',
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
    },
    profile_image: {
      type: String,
      default: null,
    },
    department: {
      type: String,
      default: null,
    },
    otherDepartmentName: {
      type: String,
      default: null,
    },
    designation: {
      type: String,
      default: null,
    },
    otherDesignationName: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      required: true,
      enum: ['Admin', 'HR', 'Employee', 'Management','TeamLead'],
      default: 'Employee',
    },
    isManagerAsTeamLead : {
      type : Boolean,
      default : false
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    teamLead : {
      type : mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default : null
    },
    dob: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      required: true,
      // uppercase: true,
      enum: ['Male', 'Female'],
      default: null,
    },
    phone: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: null,
    },
    permanentAddress: {
      type:  String,
      default: ""
    },
    currentAddress : {
      type :  String,
      default : "",
    },
    joinDate: {
      type: String,
      default: null,
    },
    addedBy: {
      type: String,
      default: null,
    },
    graduation: {
      type: String,
      default: null,
    },
    graduationDetails: [
      {
        educationTitle: { type: String, required: true },
        instituteName: { type: String, required: true },
        phone: { type: String, default: '' },
        email: { type: String, default: '' },
        address: { type: String, default: '' },
      }
    ],
    shifts: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    userAttendance : {
      type : mongoose.Schema.Types.ObjectId,
      ref : 'Attendance',
      default : null
    },
    employementType: {
      type: String,
      default: null,
    },
    payrollEnable: {
      type: Boolean,
      default: false,
    },
    salaryStatus: {
      type: Boolean,
      default: false,
    },
    aadhaarCard: { type: String, default: null },
    panCard: { type: String, default: null },
    voterId: { type: String, default: null },
    photograph: { type: String, default: null },
    addressProof: { type: String, default: null },
    otherDocument: { type: String, default: null },
    recentMarksheet: { type: String, default: null },
    bankDetails: {
      bankName: { type: String, default: null },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: null },
      accountHolderName: { type: String, default: null },
      branchName: { type: String, default: null },
      accountType: { type: String, default: null },
      upiId: { type: String, default: null },
    },
    password: {
      type: String,
      select: false,
    },
    passwordConfirm: {
      type: String,
 
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    totalSalary: { type: Number, default: 0 },
    basicWage: { type: Number, default: 0 },
    HRA: { type: Number, default: 0 },
    conveyanceAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    da: { type: Number, default: 0 },
    otherAllowance: { type: Number, default: 0 },

    tds: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    active: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

UserSchema.methods.calculateNetSalary = function () {
  const totalEarnings =
    this.basicWage +
    this.HRA +
    this.conveyanceAllowance +
    this.medicalAllowance;
  const totalDeductions = this.tds + this.professionalTax;

  this.netSalary = totalEarnings - totalDeductions;

  return this.netSalary;
};

UserSchema.pre('save', function (next) {
  this.calculateNetSalary();
  next();
});

UserSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

UserSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

UserSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};


const   User = mongoose.model('User', UserSchema);

module.exports = User;
