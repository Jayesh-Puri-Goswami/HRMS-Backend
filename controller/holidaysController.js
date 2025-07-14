const holidaysModel = require('../model/holidays.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');

// Create Holidays
// exports.createHolidays = catchAsync(async (req, res, next) => {
//   const toDate = req.body.toDate || req.body.fromDate;
//   try {
//     // Check if there is an existing
//     const isHolidaysExist = await holidaysModel.findOne({
//       holidayTitle: req.body.holidayTitle,
//       fromDate: req.body.fromDate,
//     });

//     if (isHolidaysExist) {
//       return next(new AppError('Data already exist', 401));
//     }
//     // Create a new holiday record
//     const holidays = new holidaysModel({
//       ...req.body,
//       toDate: toDate,
//     });

//     await holidays.save();
//     res.status(200).json(holidays);
//   } catch (err) {
//     console.error(err);
//     return next(new AppError('Error accrue', 401));
//   }
// });

exports.createHolidays = catchAsync(async (req, res, next) => {
  const {
    holidayTitle,
    shift,
    createdBy,
    description,
    fromDate,
    toDate,
    isActive,
  } = req.body;

  // Check if required fields are missing
  if (!holidayTitle || !shift || !description || !fromDate) {
    return next(new AppError('Missing required fields', 400));
  }

  // Default to 'fromDate' for 'toDate' if not provided
  const holidayToDate = toDate || fromDate;

  try {
    // Check if there is an existing holiday with the same title and fromDate
    const isHolidaysExist = await holidaysModel.findOne({
      holidayTitle,
      fromDate,
    });

    if (isHolidaysExist) {
      return next(
        new AppError(
          'Holiday with the same title and start date already exists',
          409
        )
      );
    }

    // Create a new holiday record
    const holiday = new holidaysModel({
      holidayTitle,
      shift,
      createdBy: createdBy ? createdBy : 'Admin',
      description,
      fromDate,
      toDate: holidayToDate, // Using the provided or default 'toDate'
      isActive: isActive !== undefined ? isActive : false, // Default isActive to true if not provided
    });

    // Save the new holiday record
    await holiday.save();

    // Return the created holiday as a response
    res.status(201).json({
      status: 'success',
      data: holiday,
    });
  } catch (err) {
    console.error(err);
    return next(
      new AppError('An error occurred while creating the holiday' + err, 500)
    );
  }
});

// Update Holidays
// exports.updateHolidays = catchAsync(async (req, res, next) => {
//   try {
//     const { holidayId } = req.params;
//     const updatedFields = {
//       holidayTitle: req.body.holidayTitle,
//       fromDate: req.body.fromDate,
//       toDate: req.body.toDate,
//       isActive: req.body.isActive,
//     };
//     // Use findByIdAndUpdate to update the holiday record
//     const holidays = await holidaysModel.findByIdAndUpdate(
//       holidayId,
//       updatedFields,
//       { new: true }
//     );

//     if (!holidays) {
//       return next(new AppError('Holiday record not found', 404));
//     }

//     res.status(200).json(holidays);
//   } catch (err) {
//     console.error(err);
//     return next(new AppError('Error occurred', 500));
//   }
// });

exports.updateHolidays = catchAsync(async (req, res, next) => {
  // const { id } = req.params;
  const { id, holidayTitle, shift, description, fromDate, toDate, isActive } =
    req.body;

  const updatedData = {
    ...(holidayTitle && { holidayTitle }),
    ...(shift && { shift }),
    ...(description && { description }),
    ...(fromDate && { fromDate }),
    ...(toDate && { toDate }),
    ...(typeof isActive === 'boolean' && { isActive }),
  };

  console.log(id);

  const updatedHoliday = await holidaysModel.findByIdAndUpdate(
    id,
    updatedData,
    { new: true, runValidators: true }
  );

  if (!updatedHoliday) {
    return next(new AppError('Holiday not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Holiday updated successfully',
    data: updatedHoliday,
  });
});

// Delete Holiday
// exports.deleteHoliday = catchAsync(async (req, res, next) => {
//   try {
//     const { holidayId } = req.params;
//     const deletedHoliday = await holidaysModel.findByIdAndDelete(holidayId);

//     if (!deletedHoliday) {
//       return next(new AppError('Holiday record not found', 404));
//     }

//     res.status(200).json({ message: 'Holiday record deleted successfully' });
//   } catch (err) {
//     console.error(err);
//     return next(new AppError('Error occurred', 500));
//   }
// });

exports.deleteHoliday = catchAsync(async (req, res, next) => {
  const { holidayId } = req.params;

  console.log(holidayId);
  

  const deletedHoliday = await holidaysModel.findByIdAndDelete(holidayId);

  if (!deletedHoliday) {
    return next(new AppError('Holiday not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Holiday deleted successfully',
    data: deletedHoliday,
  });
});

// Get All Holidays
exports.getAllHolidays = catchAsync(async (req, res) => {
  try {
    const holidays = await holidaysModel.find();

    // if (!holidays) {
    //   // return next(new AppError('Data not found!', 401));
    //   console.log('No holidays found');

    //   return res.status(200).json({ message: 'No holidays found' });
    // }

    res.status(200).json({
      success: true,
      message: `Success`,
      data: holidays,
    });
  } catch (error) {
    console.error(err);
    // return next(new AppError('Error occurred', 500));
  }
});

// exports.getAllHolidays = catchAsync(async (req, res, next) => {

//   console.log('Fetching all holidays...');

//   const holidays = await holidaysModel.find().populate('shift');

//   res.status(200).json({
//     status: 'success',
//     results: holidays.length,
//     data: holidays,
//   });
// });
