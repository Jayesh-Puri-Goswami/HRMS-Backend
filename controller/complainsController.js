const Complain = require('../model/complain.model');
const User = require('../model/admin.model');

const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');

// Create Complain
exports.createComplain = catchAsync(async (req, res, next) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return next(new AppError('Please provide all required fields', 400));
    }

    const user = await User.findById(req.user.id).select('name');

    const complain = await Complain.create({
      employeeId: req.user.id,
      title,
      description,
      employeeName: user.name,
      status: 'Pending',
    });

    const complainCreated = await complain.save();

    res.status(201).json({
      status: 'success',
      message: 'Complain created successfully',
      data: complainCreated,
    });
  } catch (error) {
    return new AppError('Error creating complain', 500);
  }
});

// Get single Employee Complains
exports.getComplaints = catchAsync(async (req, res, next) => {
  const { employeeId } = req.params;

  if (!employeeId) {
    return next(new AppError('Please provide employeeId', 400));
  }

  const complaints = await Complain.find({ employeeId });
  return res.status(200).json({
    status: 'success',
    message: 'Employee complaints fetched successfully',
    data: complaints,
  });
});

exports.getComplaintsAdmin = catchAsync(async (req, res, next) => {
  try {
    const complaints = await Complain.find({});
    return res.status(200).json({
      status: 'success',
      message: 'All complaints fetched successfully',
      data: complaints,
    });
  } catch (error) {
    return new AppError('Error fetching complaints', 500);
  }
});

exports.updateComplaintStatus = catchAsync(async (req, res, next) => {
  const { id, status } = req.body;

  // Basic validation
  if (!id || !status) {
    return next(new AppError('Complaint ID and status are required', 400));
  }

  // Allow only specific status values
  const allowedStatuses = ['Pending', 'In Progress', 'Rejected', 'Resolved'];
  if (!allowedStatuses.includes(status)) {
    return next(new AppError(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`, 400));
  }

  // Update the complaint status
  const updatedComplaint = await Complain.findByIdAndUpdate(
    id,
    {
      status,
      $push: {
        statusHistory: {
          status,
          updatedAt: new Date(),
          // updatedBy: req.user.id, // Uncomment if using auth
        }
      },
      ...(status === 'Resolved' && {
        resolvedAt: new Date(),
        // resolvedBy: req.user.id, // Uncomment if using auth
      })
    },
    { new: true }
  );

  if (!updatedComplaint) {
    return next(new AppError('Complaint not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Complaint status updated',
    data: updatedComplaint,
  });
});

