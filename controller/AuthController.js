const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const User = require("../model/admin.model");
const Email = require('../utills/email');
const employedLeave = require('../model/employeePaidLeave.model');
const catchAsync = require("../utills/catchAsync");
const AppError = require("../utills/appError");
const mongoose = require("mongoose");
const multer = require('multer');
const sharp = require('sharp');
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });
const path = require('path');
const fs = require('fs');

exports.uploadDocuments = upload.fields([
  { name: 'aadhaarCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'voterId', maxCount: 1 },
  { name: 'photograph', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'otherDocument', maxCount: 1 },
  { name: 'recentMarksheet', maxCount: 1 },
]);
 

exports.storeDocuments = catchAsync(async (req, res, next) => {
  if (!req.files) return next();

  const promises = [];

  // Process each uploaded file
  Object.keys(req.files).forEach((field) => {
    const file = req.files[field][0];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const filename = `user-${req.user.id}-${field}-${timestamp}${fileExtension}`;

    // Check file type and handle accordingly
    if (
      fileExtension === '.pdf' ||
      fileExtension === '.jpeg' ||
      fileExtension === '.png' ||
      fileExtension === '.jpg'
    ) {
      const filePath = path.join('public/employee-documents', filename);

      // For both images and PDFs, directly save the file without resizing
      const promise = fs.promises
        .writeFile(filePath, file.buffer)
        .then(() => {
          req.body[field] = filename; // Store only the filename in the request body
        })
        .catch((err) => {
          console.error('Error while saving document:', err);
        });
      promises.push(promise);
    } else {
      // Handle unsupported file types
      return next(new Error('Unsupported file type'));
    }
  });

  // Wait for all promises to finish
  await Promise.all(promises);

  console.log('Document processing promises resolved.');
  next();
});



const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  // res.cookie('jwt', token, {
  //   expires: new Date(
  //     Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
  //   ),
  //   httpOnly: true,
  //   secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  // });

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    expiresIn: 2073600, // 24 days in seconds
    data: user,
  });
};

exports.signupForAdmin = catchAsync(async (req, res, next) => {

  const email = req.body.email.replace(/\s+/g, '').trim(); // To remove whitespace from email


  const user = await User.findOne({ email: email }).select("+password");

  if (user) {
    return next(new AppError("Email already exists!", 401));
  }
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm,
      role: req.body.role,
      gender: req.body.gender,
    });
    
    createSendToken(newUser, 201, req, res);
  
});

// exports.signup = catchAsync(async (req, res, next) => {

//   const user = await User.findOne({ email: req.body.email }).select("+password");

//   if (user) {
//     return next(new AppError("Email already exists!", 401));
//   }
//     const newUser = await User.create(req.body);

//     await employedLeave.create({
//       employeeId: newUser._id,
//       employeeName: newUser.name,
//       role: newUser.role
//     });

//     new Email(newUser, req.body.password, "").sendEmail();

//     createSendToken(newUser, 201, req, res);
  
// });

exports.signup = catchAsync(async (req, res, next) => {

  try {  

  const email = req.body.email.replace(/\s+/g, '').trim().toLowerCase();

  console.log(email);

  const user = await User.findOne({ email: email }).select(
    '+password'
  );
  

  if (user) {
    return next(new AppError('Email already exists!', 401));
  }

  // Process uploaded files individually
  if (req.body.aadhaarCard) {
    req.body.aadhaarCard = req.body.aadhaarCard;
  }

  if (req.body.panCard) {
    req.body.panCard = req.body.panCard;
  }

  if (req.body.voterId) {
    req.body.voterId = req.body.voterId;
  }

  if (req.body.photograph) {
    req.body.photograph = req.body.photograph;
  }

  if (req.body.addressProof) {
    req.body.addressProof = req.body.addressProof;
  }

  if (req.body.otherDocument) {
    req.body.otherDocument = req.body.otherDocument;
  }

  if (req.body.recentMarksheet) {
    req.body.recentMarksheet = req.body.recentMarksheet;
  }

  // Convert dob and joinDate to ISO format
  if (req.body.dob) {
    req.body.dob = new Date(req.body.dob).toISOString();
  }

  if (req.body.joinDate) {
    req.body.joinDate = new Date(req.body.joinDate).toISOString();
  }

  if (req.body.isManagerAsTeamLead === 'true'){
    req.body.isManagerAsTeamLead = true
  }

  // Normalize optional ObjectId fields (manager, teamLead)
  const normalizeObjectId = (val) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
        return undefined;
      }
      return mongoose.Types.ObjectId.isValid(trimmed) ? trimmed : undefined;
    }
    return mongoose.Types.ObjectId.isValid(val) ? val : undefined;
  };

  const normalizedManager = normalizeObjectId(req.body.manager);
  const normalizedTeamLead = normalizeObjectId(req.body.teamLead);

  // Apply normalized values (omit field entirely if undefined)
  if (normalizedManager !== undefined) {
    req.body.manager = normalizedManager;
  } else {
    delete req.body.manager;
  }

  if (normalizedTeamLead !== undefined) {
    req.body.teamLead = normalizedTeamLead;
  } else {
    delete req.body.teamLead;
  }

  // If manager should also act as team lead, mirror when available
  if (req.body.isManagerAsTeamLead === true && req.body.manager && !req.body.teamLead) {
    req.body.teamLead = req.body.manager;
  }

  // console.log('This is the body' + req.body);
  

  const newUser = await User.create(req.body);

  if (newUser.employementType !== 'Probation') {

    await employedLeave.create({
      employeeId: newUser._id,
      employeeName: newUser.name,
      role: newUser.role,
      casualLeave: 6,
      personalLeave: 6,
      medicalLeave: 6,
    });
  } else {
    await employedLeave.create({
      employeeId: newUser._id,
      employeeName: newUser.name,
      role: newUser.role,
      casualLeave: 0,
      personalLeave: 0,
      medicalLeave: 0,
    });
  }

  new Email(newUser, req.body.password, '').sendEmail();

  createSendToken(newUser, 201, req, res);
  } catch (error) {
    console.log(error)
    return next(new AppError(`Error creating user: ${error}`, 500));
  }
});

exports.editEmployee = catchAsync(async (req, res, next) => {
  // Check if the employee with the given ID exists
  const user = await User.findById(req.params.id).select('+password');
  if (!user) {
    return next(new AppError('Employee not found!', 404));
  }

  const currentEmployementType = user.employementType;

  // Check if email already exists for other users
  const emailExist = await User.findOne({ email: req.body.email }).select(
    '+password'
  );
  if (emailExist && emailExist._id.toString() !== req.params.id) {
    return next(new AppError('Email already exists!', 401));
  }

  // Process uploaded files individually, replacing the existing ones if provided
  if (req.body.aadhaarCard) {
    user.aadhaarCard = req.body.aadhaarCard;
  }
  if (req.body.panCard) {
    user.panCard = req.body.panCard;
  }
  if (req.body.voterId) {
    user.voterId = req.body.voterId;
  }
  if (req.body.photograph) {
    user.photograph = req.body.photograph;
  }
  if (req.body.addressProof) {
    user.addressProof = req.body.addressProof;
  }
  if (req.body.otherDocument) {
    user.otherDocument = req.body.otherDocument;
  }
  if (req.body.recentMarksheet) {
    user.recentMarksheet = req.body.recentMarksheet;
  }

  if(req.body.isManagerAsTeamLead === 'true'){
    req.body.isManagerAsTeamLead = true
  }

  if (req.body.teamLead === 'null') {
    req.body.teamLead = null;
  }



  // Handle password update
  if (req.body.password && req.body.password.trim() !== '') {
    user.password = req.body.password;
    console.log('Password updated for user:', user.email);
  }

  console.log('Password field received:', req.body.password ? 'Yes' : 'No');

  // Convert dob and joinDate to ISO format if they exist
  if (req.body.dob) {
    user.dob = new Date(req.body.dob).toISOString();
  }
  if (req.body.joinDate) {
    user.joinDate = new Date(req.body.joinDate).toISOString();
  }

  // Update the rest of the fields
  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.role = req.body.role || user.role;
  user.employementType = req.body.employementType || user.employementType;
  user.address = req.body.address || user.address;
  user.phone = req.body.phone || user.phone;
  user.gender = req.body.gender || user.gender;
  user.department = req.body.department || user.department;
  user.designation = req.body.designation || user.designation;
  user.otherDepartmentName =
    req.body.otherDepartmentName || user.otherDepartmentName;
  user.otherDesignationName =
    req.body.otherDesignationName || user.otherDesignationName;
  user.org = req.body.org || user.org  ;
  user.isManagerAsTeamLead = req.body.isManagerAsTeamLead ;
  user.teamLead = req.body.teamLead || null;
  user.graduation = req.body.graduation || user.graduation;
  user.shifts = req.body.shifts || user.shifts;
  user.payrollEnable = req.body.payrollEnable || user.payrollEnable;
  user.salaryStatus = req.body.salaryStatus || user.salaryStatus;
  user.addedBy = req.body.addedBy || user.addedBy;
  user.manager = req.body.manager || user.manager;
  user.totalSalary = req.body.totalSalary || user.totalSalary;
  user.basicWage = req.body.basicWage || user.basicWage;
  user.HRA = req.body.HRA || user.HRA;
  user.conveyanceAllowance =
    req.body.conveyanceAllowance || user.conveyanceAllowance;
  user.medicalAllowance = req.body.medicalAllowance || user.medicalAllowance;
  user.da = req.body.da || user.da;
  user.otherAllowance = req.body.otherAllowance || user.otherAllowance;
  user.tds = req.body.tds || user.tds;
  user.professionalTax = req.body.professionalTax || user.professionalTax;

  console.log(typeof(user.teamLead));
  

  // Save the updated user data
  const updatedUser = await user.save();

  // Check if the employmentType has changed
  if (req.body.employementType !== currentEmployementType) {
    if (req.body.employementType === 'Probation') {
      // Set the leave details to 0 when changing to 'Probation'
      await employedLeave.updateOne(
        { employeeId: user._id },
        {
          casualLeave: 0,
          personalLeave: 0,
          medicalLeave: 0,
        }
      );
    } else if (currentEmployementType === 'Probation') {
      // Set the leave details to 6 when changing from 'Probation' to another type
      await employedLeave.updateOne(
        { employeeId: user._id },
        {
          casualLeave: 6,
          personalLeave: 6,
          medicalLeave: 6,
        }
      );
    }
  }

  // Send response with updated data
  res.status(200).json({
    status: 'success',
    data: {
      data: updatedUser,
    },
  });
});

exports.login = catchAsync(async (req, res, next) => {


  const { email, password } = req.body;

  console.log(email, password);
  

  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // For Tracking Employee Login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  // res.cookie('jwt', 'loggedout', {
  //   expires: new Date(Date.now() + 10 * 1000),
  //   httpOnly: true
  // });
  // res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // else if (req.cookies.jwt) {
  //   token = req.cookies.jwt;
  // }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }
  // 4) Check if user changed password after the token was issued
  // if (currentUser.changedPasswordAfter(decoded.iat)) {
  //   return next(
  //     new AppError('User recently changed password! Please log in again.', 401)
  //   );
  // }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    console.log(req.user.role)

    next();
  };
};

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});


exports.forgotPassword = catchAsync(async (req, res, next) => {
  console.log(req.body.email)
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    const resetURL = `http://82.180.132.16:8000/#/signin/reset-password/${resetToken}`;

    // const CLIENT_URL = 'http://' + req.headers.host;

    new Email(user, "", resetURL).sendForgotPasswordEmail();


    res.status(200).json({
      status: "success",
      message:
        "Password reset link sent to email ID. Please follow the instructions.",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError("There was an error sending the email. Try again later!"),
      500
    );
  }
});


exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }
  if (req.body.password != req.body.passwordConfirm) {
    return next(new AppError("Password does not match with confirm password", 400));
  }
  if (req.body.password.length < 8) {
    return next(new AppError("Password must be 8 numbers", 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});


