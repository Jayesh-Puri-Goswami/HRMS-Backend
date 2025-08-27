const PaySlip = require('../model/paySlip.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const moment = require('moment');
const Payroll = require('../model/payroll.model');

// For Admin
exports.generatePaySlip = catchAsync(async (req, res, next) => {
  let {
    employeeId,
    salaryMonth,
    salaryYear,
    basicWage,
    HRA,
    conveyanceAllowance,
    medicalAllowance,
    otherAllowance,
    EPF,
    ESI_HealthInsurance,
    professionalTax,
    loanRecovery,
    leaveDeductionAmount,
    totalEarning,
    totalDeduction,
    netSalary,
    createdBy
  } = req.body;
  try {
    // Check if there is an existing
    const isEmployeeExist = await Employee.findOne({
      _id: employeeId,
    });

    if (!isEmployeeExist) {
      return next(new AppError('Data not found!', 401));
    }

    const isPaySlipExist = await PaySlip.findOne({
      employeeId: employeeId,
      salaryMonth,
      salaryYear,
    });

    if (isPaySlipExist) {
      return next(
        new AppError('Pay slip record already exists for this month', 401)
      );
    }
    // Create a new pay slip record
    const paySlip = new PaySlip({
      employeeId: employeeId,
      employeeName: isEmployeeExist.name,
      salaryMonth: salaryMonth,
      salaryYear: salaryYear,
      basicWage: basicWage,
      HRA: HRA,
      conveyanceAllowance: conveyanceAllowance,
      medicalAllowance: medicalAllowance,
      otherAllowance: otherAllowance,
      EPF: EPF,
      ESI_HealthInsurance: ESI_HealthInsurance,
      professionalTax: professionalTax,
      loanRecovery: loanRecovery,
      leaveDeductionAmount:leaveDeductionAmount,
      totalEarning: totalEarning,
      totalDeduction: totalDeduction,
      netSalary: netSalary,
      createdBy: req.user.name
    });

    await paySlip.save();
    res.status(200).json(paySlip);
  } catch (err) {
    console.error(err);
    return next(new AppError('Error saving pay slip', 401));
  }
});

exports.getEmployeesPaySlip = catchAsync(
  exports.getPaySlips = async (req, res, next) => {
    const { year, month, employeeName, page, pageSize } = req.query;
    const pageNum = parseInt(page) || 1;
    const size = parseInt(pageSize) || 10;
    const skip = (pageNum - 1) * size;
  
    // Build the query object based on provided filters
    const query = {
      isActive: true,
    };
  
    if (year) {
      query.salaryYear = year;
    }
  
    if (month) {
      query.salaryMonth = month;
    }
  
    if (employeeName) {
      query.employeeName = { $regex: employeeName, $options: 'i' };
    }

    try {
      const totalItems = await PaySlip.countDocuments(query);
      const paySlips = await PaySlip.find(query)
        .skip(skip)
        .limit(size);
  
      return res.status(200).json({
        message: 'Pay slips retrieved successfully',
        paySlips,
        page,
        totalItems,
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Error retrieving pay slips',
        error: error.message,
      });
    }
  }
)

exports.getEmployeePaySlipById = catchAsync(async (req, res) => {
  const Id = req.params.id;

  try {
    const Data = await Payroll.findOne({ _id: Id }).populate('employeeId');
    if (!Data) {
      return res.status(404).json({ message: 'Data not found.' });
    }

    res.json(Data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



exports.getEmplpoyeePaySlip_Data = catchAsync(async (req, res) => {
  const Id = req.params.id;

  try {
    const Data = await PaySlip.findOne({ _id: Id }).populate('employeeId');

    if (!Data) {
      return res.status(404).json({ message: 'Data not found.' });
    }

    res.json(Data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

exports.updatePaySlip = catchAsync(async (req, res, next) => {
  const paySlipId = req.params.id;

  // Extract the fields you want to update from the request body
  let {
    basicWage,
    HRA,
    conveyanceAllowance,
    medicalAllowance,
    otherAllowance,
    EPF,
    ESI_HealthInsurance,
    professionalTax,
    loanRecovery,
    leaveDeductionAmount,
    totalEarning,
    totalDeduction,
    netSalary
  } = req.body;

  try {
    // Check if the pay slip exists
    const paySlip = await PaySlip.findById(paySlipId);

    if (!paySlip) {
      return next(new AppError('Pay slip not found!', 404));
    }

    // Update the pay slip fields with the new values
    paySlip.basicWage = basicWage;
    paySlip.HRA = HRA;
    paySlip.conveyanceAllowance = conveyanceAllowance;
    paySlip.medicalAllowance = medicalAllowance;
    paySlip.otherAllowance = otherAllowance;
    paySlip.EPF = EPF;
    paySlip.ESI_HealthInsurance = ESI_HealthInsurance;
    paySlip.professionalTax = professionalTax;
    paySlip.loanRecovery = loanRecovery;
    paySlip.leaveDeductionAmount = leaveDeductionAmount;
    paySlip.totalEarning = totalEarning;
    paySlip.totalDeduction = totalDeduction;
    paySlip.netSalary = netSalary;

    // Save the updated pay slip
    const updatedPaySlip = await paySlip.save();
    res.status(200).json(updatedPaySlip);
  } catch (err) {
    console.error(err);
    return next(new AppError('Error updating pay slip', 401));
  }
});


exports.deletePaySlip = catchAsync(async (req, res, next) => {
  const paySlipId = req.params.id;

  // Find the PaySlip by its ID and delete it
  const deletedPaySlip = await PaySlip.findByIdAndDelete(paySlipId);

  if (!deletedPaySlip) {
    return next(new AppError('Pay slip not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: deletedPaySlip,
  });
});


// For Employee
exports.getPaySlipByEmployee = catchAsync(async (req, res, next) => {
  const userId = req.params.id || req.user._id;
  const { year, month, page, pageSize } = req.query;
  const pageNum = parseInt(page) || 1;
  const size = parseInt(pageSize) || 10;
  const skip = (pageNum - 1) * size;

  // Build the query object based on provided filters
  const query = {
    isActive: true,
    employeeId: userId,
  };

  if (year) {
    query.salaryYear = year;
  }

  if (month) {
    query.salaryMonth = month;
  }

  try {
    const totalItems = await Payroll.countDocuments(query);
    const paySlips = await Payroll.find(query).skip(skip).limit(size);

    return res.status(200).json({
      message: 'Pay slips retrieved successfully',
      paySlips,
      totalItems,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Error retrieving pay slips',
      error: error.message,
    });
  }
});


// exports.getPaySlipByEmployee =  catchAsync(
// async (req, res, next) => {
//   console.log(req.user.id)
//     const { year, month, page, pageSize } = req.query;
//     const pageNum = parseInt(page) || 1;
//     const size = parseInt(pageSize) || 10;
//     const skip = (pageNum - 1) * size;
  
//     // Build the query object based on provided filters
//     const query = {
//       isActive: true,
//       employeeId: req.user._id, // Assuming you have the authenticated user's _id available in req.user._id
//     };
  
//     if (year) {
//       query.salaryYear = year;
//     }
  
//     if (month) {
//       query.salaryMonth = month;
//     }
  
//     console.log(year);  console.log(month)
//     try {
//       const totalItems = await PaySlip.countDocuments(query);
//       const paySlips = await PaySlip.find(query)
//         .skip(skip)
//         .limit(size);

//         console.log(paySlips)
  
//       return res.status(200).json({
//         message: 'Pay slips retrieved successfully',
//         paySlips,
//         totalItems,
//       });
//     } catch (error) {
//       return res.status(500).json({
//         message: 'Error retrieving pay slips',
//         error: error.message,
//       });
//     }
//   }
// )

