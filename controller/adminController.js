const multer = require('multer');
const sharp = require('sharp');
const User = require('../model/admin.model');
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
    let getAllEmployeeCount = await User.find({ role: { $ne: "Admin" } });
    res.status(200).json({
      count: getAllEmployeeCount.length,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving records', 401));
  }
});


exports.getEmployeeCountsByType = catchAsync(async (req, res, next) => {
  try {
    const employeeCounts = await User.aggregate([
      {
        $match: {
          role: { $ne: 'Admin' }, 
        },
      },
      {
        $group: {
          _id: "$employementType",
          count: { $sum: 1 }, 
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: employeeCounts,
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
      managers,
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
