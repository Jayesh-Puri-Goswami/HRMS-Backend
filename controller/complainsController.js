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
  const { search, page = 1, limit = 6 } = req.query;

  if (!employeeId) {
    return next(new AppError('Please provide employeeId', 400));
  }

  // Build search query
  let searchQuery = { employeeId };
  
  if (search && search.trim()) {
    searchQuery.title = { $regex: search.trim(), $options: 'i' };
  }

  // Calculate pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination
  const totalComplaints = await Complain.countDocuments(searchQuery);
  const totalPages = Math.ceil(totalComplaints / limitNum);

  // Get complaints with pagination
  const complaints = await Complain.find(searchQuery)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  return res.status(200).json({
    status: 'success',
    message: 'Employee complaints fetched successfully',
    data: complaints,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalComplaints,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    }
  });
});


exports.getComplaintsAdmin = catchAsync(async (req, res, next) => {
  try {
    const { search, page = 1, limit = 6 } = req.query;

    // Build search query
    let searchQuery = {};
    
    if (search && search.trim()) {
      searchQuery.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { employeeName: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalComplaints = await Complain.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalComplaints / limitNum);

    // Get complaints with pagination and populate employee info
    const complaints = await Complain.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      status: 'success',
      message: 'All complaints fetched successfully',
      data: complaints,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalComplaints,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    return next(new AppError('Error fetching complaints', 500));
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

