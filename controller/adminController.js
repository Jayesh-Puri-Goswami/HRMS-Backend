const multer = require('multer');
const sharp = require('sharp');
const User = require('../model/admin.model');
const Attendance = require('../model/attendance.model');
const LeaveRequest = require('../model/leaves.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const factory = require('./handlerFactory');
const APIFeatures = require('../utills/apiFeatures');
const multerStorage = multer.memoryStorage();
const bcrypt = require('bcryptjs');

const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new AppError('Not an image! Please upload only images.', 400), false);
    }
};

const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter
});


exports.uploadUserPhoto = upload.single('profile_image');

exports.uploadDocuments = upload.fields([
    { name: 'aadhar_card', maxCount: 1 },
    { name: 'pan_card', maxCount: 1 }
]);

// exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
//     if (!req.file) return next();
//     req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

//     await sharp(req.file.buffer)
//         .resize(500, 500)
//         .toFormat('jpeg')
//         .jpeg({ quality: 90 })
//         .toFile(`public/img/users/${req.file.filename}`);

//     next();
// });

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .rotate()
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});


exports.resizeDocuments = catchAsync(async (req, res, next) => {
    if (!req.files) return next();

    const promises = [];

    // Process each uploaded file
    Object.keys(req.files).forEach(field => {
        const file = req.files[field][0];
        const filename = `user-${req.user.id}-${field}-${Date.now()}.jpeg`;

        const promise = sharp(file.buffer)
            .resize(500, 500)
            .toFormat('jpeg')
            .jpeg({ quality: 90 })
            .toFile(`public/img/users/${filename}`)
            .then(() => {
                // Add the filename property to the req.files object
                req.files[field][0].filename = filename;
            })
            .catch(err => {
                console.error('Error while processing image:', err);
                // You might want to handle the error here
            });

        promises.push(promise);
    });

    // Wait for all promises to finish
    await Promise.all(promises);

    console.log('Image processing promises resolved.'); // Add this line

    next();
});

const filterObj = (obj, ...allowedFields) => {
    const newObj = {};
    Object.keys(obj).forEach(el => {
        if (allowedFields.includes(el)) newObj[el] = obj[el];
    });
    return newObj;
};

exports.getMe = (req, res, next) => {
    req.params.id = req.user.id;
    next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
    // 1) Create error if user POSTs password data
    if (req.body.password || req.body.passwordConfirm) {
        return next(
            new AppError(
                'This route is not for password updates. Please use /updateMyPassword.',
                400
            )
        );
    }

    // 2) Filtered out unwanted fields names that are not allowed to be updated
    const filteredBody = filterObj(req.body, 'name', 'email');
    if (req.file) filteredBody.profile_image = req.file.filename;

    // 3) Update user document
    const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        status: 'success',
        data: updatedUser
    });
});

exports.getAllEmployeeCount = catchAsync(async (req, res, next) => {
  try {
    const totalCount = await User.countDocuments({ role: { $ne: 'Admin' } });

    res.status(200).json({
      count: totalCount,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving records', 401));
  }
});

exports.getHrDashboard = catchAsync(async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const totalEmployee = await User.countDocuments({ role: { $ne: 'Admin' } });

    const onLeaveIds = await LeaveRequest.distinct('employeeId', {
      status: 'approved',
      'leaveDetails.date': { $gte: today, $lt: tomorrow },
    });
    
    const leaveEmployees = onLeaveIds.length;

    const halfDayEmployeeIds = await LeaveRequest.distinct('employeeId', {
      status: 'approved',
      'leaveDetails': { $elemMatch: { date: { $gte: today, $lt: tomorrow }, halfDay: true } },
    });

    const halfDayEmployees = halfDayEmployeeIds.length;

    const presentEmployeeIds = await Attendance.distinct('employeeId', {
      date: { $gte: today, $lt: tomorrow },
    });
    
    const absentEmployees = await User.countDocuments({
        role: { $ne: 'Admin' },
        _id: { $nin: [...presentEmployeeIds, ...onLeaveIds] }
    });

    res.status(200).json({
      totalEmployee,
      absentEmployees,
      leaveEmployees,
      halfDayEmployees
    });
  } catch (error) {
    console.error(error)
    return next(new AppError('Error retrieving records', 500));
  }
})


exports.getEmployeeCountsByType = catchAsync(async (req, res, next) => {
  try {
    const employeeCounts = await User.aggregate([
      {
        $match: {
          role: { $ne: 'Admin' }
        },
      },
      {
        $group: {
          _id: '$employementType',
          count: { $sum: 1 }
        },
      },
      {
        $sort: { _id: 1 } 
      }
    ]);

    res.status(200).json({
      success: true,
      total: employeeCounts.reduce((sum, type) => sum + type.count, 0), // total = 68
      data: employeeCounts
    });
  } catch (err) {
    console.error(err);
    return next(new AppError("Error retrieving employee counts", 500));
  }
});




exports.updateData = catchAsync(async (req, res, next) => {
    // 1) Create error if user POSTs password data
    if (req.body.password || req.body.passwordConfirm) {
        return next(
            new AppError(
                'This route is not for password updates. Please use /updateMyPassword.',
                400
            )
        );
    }
    // 2) Filtered out unwanted fields names that are not allowed to be updated
    const allowedFields = ['bankDetails'];
    const filteredBody = filterObj(req.body, ...allowedFields);

    // 3) Handle file uploads and store filenames
    const files = {};
    if (req.files) {
        Object.keys(req.files).forEach(field => {
            if (req.files[field][0].size > 0) {
                files[field] = req.files[field][0].filename;
            }
        });
    }
    
    // 4) Merge filteredBody and files
    const updatedData = { ...filteredBody, ...files };
    // 5) Update user document
    const updatedUser = await User.findByIdAndUpdate(req.user.id, updatedData, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        status: 'success',
        data: updatedUser
    });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
  // Only allow updating name and email
  const allowedFields = ['name', 'email'];
  const filteredBody = filterObj(req.body, ...allowedFields);
  
  // Check if email is being updated
  if (filteredBody.email) {
    const existingUser = await User.findOne({ email: filteredBody.email });

    // If email exists and belongs to a different user, return error
    if (existingUser && existingUser.id !== req.user.id) {
      return next(new AppError('Email already in use', 400));
    }
  }

  // Prepare update object dynamically
  const updateData = {};
  if (filteredBody.name) updateData.name = filteredBody.name;
  if (filteredBody.email) updateData.email = filteredBody.email;

  // Update user with only the provided fields
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    updateData, // Update only existing fields
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: updatedUser,
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
    await User.findByIdAndUpdate(req.user.id, { active: false });

    res.status(204).json({
        status: 'success',
        data: null
    });
});

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);
exports.getAllManagement = factory.getAllManagement(User);
exports.getAllEmployee = factory.getEmployees(User,'shifts');

// Do NOT update passwords with this!
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
exports.updateProbation = factory.updateProbation(User);

exports.getAllManagers = catchAsync(async (req, res, next) => {
  let filter = { role: 'Management' }; // Fetch only users with role 'Management'

  if (req.params.userId) {
    filter._id = req.params.userId; // If a specific userId is provided, fetch that manager
  }

  const features = new APIFeatures(User.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const managers = await features.query;

  res.status(200).json({
    status: 'success',
    results: managers.length,
    data: {
      managers: managers.map(manager => ({
        _id: manager._id,
        name: manager.name,
        profile_image: manager.profile_image,
      })),
    },
  });
});

exports.getAllTeamLeads = catchAsync(async (req, res, next) => {
  let filter = { role: 'TeamLead' }; // Fetch only users with role 'Management'

  if (req.params.userId) {
    filter._id = req.params.userId; // If a specific userId is provided, fetch that manager
  }

  const features = new APIFeatures(User.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const teamLeads = await features.query;

  res.status(200).json({
    status: 'success',
    results: teamLeads.length,
    data: {
      teamLeads: teamLeads.map(manager => ({
        _id: manager._id,
        name: manager.name,
        profile_image: manager.profile_image,
      })),
    },
  });
});

exports.changePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return next(new AppError('Please provide all required fields.', 400));
  }

//   if (newPassword !== confirmPassword) {
//     return next(
//       new AppError('New password and confirm password do not match.', 400)
//     );
//   }

  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);

  if (!isMatch) {
    return next(new AppError('Incorrect current password.', 401));
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully.',
  });
});


// New APIs 

exports.getEmployeeAddress = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user.id;
  const user = await User.findById(userId).select('permanentAddress currentAddress');

  if (!user) return next(new AppError('User not found', 404));

  res.status(200).json({
    status: 'success',
    data: {
      permanentAddress: user.permanentAddress || null,
      currentAddress: user.currentAddress || null,
    },
  });
});

exports.updateEmployeePermanentAddress = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user.id;
  const { permanentAddress } = req.body;

  if (!permanentAddress) return next(new AppError('Permanent address is required', 400));

  const user = await User.findByIdAndUpdate(
    userId,
    { permanentAddress },
    { new: true, runValidators: true }
  ).select('permanentAddress');

  res.status(200).json({
    status: 'success',
    message: 'Permanent address updated successfully',
    data: user,
  });
});


exports.updateEmployeeCurrentAddress = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user.id;
  const { currentAddress } = req.body;

  if (!currentAddress) return next(new AppError('Current address is required', 400));

  const user = await User.findByIdAndUpdate(
    userId,
    { currentAddress },
    { new: true, runValidators: true }
  ).select('currentAddress');

  res.status(200).json({
    status: 'success',
    message: 'Current address updated successfully',
    data: user,
  });
});


exports.getEmployeeDocuments = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user.id;
  
  const user = await User.findById(userId).select(
    'aadhaarCard panCard voterId photograph addressProof otherDocument recentMarksheet'
  );

  if (!user) return next(new AppError('User not found', 404));
  res.status(200).json({
    status: 'success',
    data: {
      documents: {
        aadhaarCard: user.aadhaarCard,
        panCard: user.panCard,
        voterId: user.voterId,
        photograph: user.photograph,
        addressProof: user.addressProof,
        otherDocument: user.otherDocument,
        recentMarksheet: user.recentMarksheet
      }
    }
  });
});

// Upload/update one or more employee documents
exports.updateEmployeeDocuments = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user.id;

  // List of document fields
  const docFields = [
    'aadhaarCard',
    'panCard',
    'voterId',
    'photograph',
    'addressProof',
    'otherDocument',
    'recentMarksheet'
  ];

  // Prepare update object dynamically
  const updateData = {};
  docFields.forEach(field => {
    if (req.body && req.body[field]) {
      updateData[field] = req.body[field];
    }
  });

  if (Object.keys(updateData).length === 0) {
    return next(new AppError('No document fields provided for update', 400));
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!updatedUser) return next(new AppError('User not found', 404));

  res.status(200).json({
    status: 'success',
    message: 'Documents updated',
    data: {
      documents: docFields.reduce((acc, field) => {
        acc[field] = updatedUser[field];
        return acc;
      }, {})
    }
  });
});

exports.getEmployeeBankDetails = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user.id;

  const user = await User.findById(userId).select('bankDetails');

  if (!user) return next(new AppError('User not found', 404));

  res.status(200).json({
    status: 'success',
    data: {
      bankDetails: user.bankDetails
    }
  })
})

exports.updateEmployeeBankDetails = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user.id;
  const allowedFields = [
    'bankName',
    'accountNumber',
    'ifscCode',
    'accountHolderName',
    'branchName',
    'accountType',
    'upiId',
  ];
  const updateData = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updateData[`bankDetails.${field}`] = req.body[field];
    }
  });
  if (Object.keys(updateData).length === 0) {
    return next(new AppError('No bank detail fields provided for update', 400));
  }
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('bankDetails');
  if (!updatedUser) return next(new AppError('User not found', 404));
  res.status(200).json({
    status: 'success',
    message: 'Bank details updated',
    data: {
      bankDetails: updatedUser.bankDetails
    }
  });
});


exports.getEmployeeGraduationDetails = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user.id;
  const user = await User.findById(userId).select('graduationDetails');
  if (!user) return next(new AppError('User not found', 404));
  res.status(200).json({
    status: 'success',
    data: {
      graduationDetails: user.graduationDetails || []
    }
  });
});

exports.updateEmployeeGraduationDetails = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user.id;
  const { graduationDetails } = req.body;
  if (!Array.isArray(graduationDetails)) {
    return next(new AppError('graduationDetails must be an array', 400));
  }
  const user = await User.findByIdAndUpdate(
    userId,
    { graduationDetails },
    { new: true, runValidators: true }
  ).select('graduationDetails');
  if (!user) return next(new AppError('User not found', 404));
  res.status(200).json({
    status: 'success',
    message: 'Graduation details updated',
    data: {
      graduationDetails: user.graduationDetails
    }
  });
});