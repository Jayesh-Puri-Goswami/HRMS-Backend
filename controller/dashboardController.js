const User = require('../model/admin.model');
const AppError = require('../utills/appError');
const catchAsync = require('../utills/catchAsync');

exports.getEmployeeData = catchAsync(async (req, res, next) => {
  try {
    const userId = req.user.id;
    const employeeData = await User.findOne({ _id: userId }).populate('shifts')

    if (!employeeData) {
      return next(new AppError('Employee not found', 404));
    }
    return res.status(200).json({
      status: 'success',
      data: employeeData,
    });
  } catch (error) {
    return next(new AppError('Error fetching employee data', 500));
  }
});

exports.getEmployeeByRole = catchAsync(async (req, res, next) => {
  try {
    const userRole = req.user.role; // Assuming `req.user.role` contains the role of the logged-in user
    let rolesToFetch = [];

    // Determine roles to fetch based on the requesting user's role
    if (userRole === 'Admin') {
      rolesToFetch = ['Admin', 'HR', 'Management', 'TeamLead', 'Employee'];
    } else if (userRole === 'HR') {
      rolesToFetch = ['Admin','HR', 'Management', 'TeamLead', 'Employee'];
    } else if (userRole === 'Management') {
      rolesToFetch = ['Management', 'TeamLead', 'Employee'];
    } else if (userRole === 'TeamLead') {
      rolesToFetch = ['Management','TeamLead', 'Employee'];
    } else if (userRole === 'Employee') {
      rolesToFetch = ['Employee'];
    } else {
      return next(new AppError('Invalid role', 403));
    }

    // Fetch users based on the determined roles
    const employees = await (await User.find({ role: { $in: rolesToFetch } }).select('name _id'))

    if (!employees || employees.length === 0) {
      return next(new AppError('No employees found for the given role', 404));
    }

    return res.status(200).json({
      status: 'success',
      data: employees,
    });
  } catch (error) {
    return next(new AppError('Error fetching employee data', 500));
  }
});



