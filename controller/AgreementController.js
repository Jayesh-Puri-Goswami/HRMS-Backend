const EmployeeAgreement = require('../model/agreement.model'); // Ensure correct model name
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const mongoose = require('mongoose');


// Create Agreement
exports.createAgreement = catchAsync(async (req, res, next) => {
  const { employeeId, startDate, endDate } = req.body;

  if (!employeeId || !startDate || !endDate || !req.file) {
    return next(
      new AppError('Please provide all required fields and upload a file', 400)
    );
  }

  const file = req.file;
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const timestamp = Date.now();
  const filename = `agreement-${employeeId}-${timestamp}${fileExtension}`;

  // Validate file type
  if (fileExtension !== '.pdf') {
    return next(
      new AppError('Unsupported file type, only PDF is allowed', 400)
    );
  }

  const filePath = path.join('public/agreements', filename);

  // Save file to the filesystem
  await fs.promises.writeFile(filePath, file.buffer);

  // Store agreement in the database
  const agreement = await EmployeeAgreement.create({
    employeeId,
    startDate,
    endDate,
    file: filename, // Store file name in DB
  });

  res.status(201).json({
    status: 'success',
    message: 'Agreement created successfully',
    data: agreement,
  });
});

// Update Agreement
exports.updateAgreement = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { startDate, endDate } = req.body;

  // Find existing agreement
  const existingAgreement = await EmployeeAgreement.findById(id);
  if (!existingAgreement) {
    return next(new AppError('Agreement not found', 404));
  }

  let filename = existingAgreement.file;

  if (req.file) {
    const file = req.file;
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    filename = `agreement-${existingAgreement.employeeId}-${timestamp}${fileExtension}`;

    // Validate file type
    if (fileExtension !== '.pdf') {
      return next(
        new AppError('Unsupported file type, only PDF is allowed', 400)
      );
    }

    const filePath = path.join('public/agreements', filename);

    // Delete old file if it exists
    if (existingAgreement.file) {
      const oldFilePath = path.join(
        'public/agreements',
        existingAgreement.file
      );
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Save new file to filesystem
    await fs.promises.writeFile(filePath, file.buffer);
  }

  // Update agreement in DB
  existingAgreement.startDate = startDate;
  existingAgreement.endDate = endDate;
  existingAgreement.file = filename;

  await existingAgreement.save();

  res.status(200).json({
    status: 'success',
    message: 'Agreement updated successfully',
    data: existingAgreement,
  });
});

// Get All Agreements
exports.getAllAgreements = catchAsync(async (req, res, next) => {
  const { startDate, endDate, employee } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};

  if (employee && mongoose.Types.ObjectId.isValid(employee)) {
    query.employeeId = employee;
  }

  if (startDate && endDate) {
    const start = moment(startDate).startOf('day').toDate();
    const end = moment(endDate).endOf('day').toDate();

    query.$or = [
      { startDate: { $gte: start, $lte: end } },
      { endDate: { $gte: start, $lte: end } },
      {
        startDate: { $lte: start },
        endDate: { $gte: end },
      },
    ];
  }

  // Filter by employeeId (ObjectId check)
  if (employee && mongoose.Types.ObjectId.isValid(employee)) {
    query.employeeId = employee;
  }

  try {
    const [agreementRecords, totalRecords] = await Promise.all([
      EmployeeAgreement.find(query)
        .sort({ createdAt: -1 })
        .populate('employeeId')
        .skip(skip)
        .limit(limit),
      EmployeeAgreement.countDocuments(query),
    ]);

    res.status(200).json({
      agreementRecords,
      page,
      limit,
      totalCount: totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving agreement records', 401));
  }
});

// Get Single Agreement
exports.getAgreementById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const agreement = await EmployeeAgreement.findById(id).populate(
    'employeeId',
    'name email'
  );

  if (!agreement) {
    return next(new AppError('Agreement not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: agreement,
  });
});

exports.deleteAgreement = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const agreement = await EmployeeAgreement.findById(id);
  if (!agreement) {
    return next(new AppError('Agreement not found', 404));
  }

  // Delete the file from the filesystem
  const filePath = path.join('public/agreements', agreement.file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await EmployeeAgreement.findByIdAndDelete(id);

  res.status(200).json({
    status: 'success',
    message: 'Agreement deleted successfully',
  });
});




// FOR EMPLOYEE ***********************


exports.getEmployeeAllAgreement = catchAsync(async (req, res, next) => {
  const employeeId = req.params.id || req.user.id;

  if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
    return next(new AppError('Invalid or missing employeeId', 400));
  }

  try {
    const agreements = await EmployeeAgreement.find({ employeeId })
      .sort({ createdAt: -1 })
      .populate('employeeId')

    res.status(200).json({
      status: 'success',
      results: agreements.length,
      data: agreements,
    });
  } catch (err) {
    console.error(err);
    return next(new AppError('Error retrieving employee agreements', 500));
  }
});
