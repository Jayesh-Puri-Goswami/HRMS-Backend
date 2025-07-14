const PaySlip = require('../model/paySlip.model');
const Employee = require('../model/admin.model');
const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const moment = require('moment');
const Payroll = require('../model/payroll.model');
const cron = require('node-cron');
const Email = require('../utills/email');
const leavesModel = require('../model/leaves.model');


exports.generateEmployeeSalaryCron = catchAsync(async (req, res, next) => {
  // cron.schedule('0 15 28-31 * *', async () => {

  // This cron job runs at 12.00 AM on the every 1st day of the month
    cron.schedule('0 0 1 * *', async () => {
    const today = moment();
    const isLastDayOfMonth = today.isSame(today.clone().endOf('month'), 'day');
    if (!isLastDayOfMonth) {
      console.log(
        'Payroll generation can only be done on the last day of the month.'
      );
      return;
    }

    const salaryMonth = today.format('MMMM');
    const salaryYear = today.year();

    // Validate input parameters
    if (!salaryMonth || !salaryYear) {
      console.log('Salary month and year are required.');
    }

    // Ensure the salary year is a valid number
    if (
      isNaN(salaryYear) ||
      salaryYear < 1900 ||
      salaryYear > new Date().getFullYear()
    ) {
      console.log('Invalid salary year.');
    }

    // Ensure the salary month is a valid string
    const validMonths = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    if (!validMonths.includes(salaryMonth)) {
      console.log('Invalid salary month.');
    }

    // Fetch Employees Data
    const employees = await Employee.find({
      active: true,
      payrollEnable: true,
      salaryStatus: true,
      role: { $in: ['HR', 'Employee', 'Management'] },
    });

    if (!employees.length) {
      console.log('No eligible employees found for payroll generation');
    }

    const payrollEntries = [];

    for (let employee of employees) {
      const totalSalary = employee.totalSalary || 0;
      const basicWage = employee.basicWage || 0;
      const HRA = employee.HRA || 0;
      const conveyanceAllowance = employee.conveyanceAllowance || 0;
      const medicalAllowance = employee.medicalAllowance || 0;
      const da = employee.da || 0;
      const otherAll = employee.otherAllowance || 0;

      // const totalEarning =
      //   basicWage + HRA + conveyanceAllowance + medicalAllowance;

      const totalEarning = totalSalary;

      const tds = employee.tds || 0;
      const professionalTax = employee.professionalTax || 0;

      // LEAVE DEDUCTION CALCULATION

      // Fetch leave requests and filter leaveDetails for LWP
      const leaveRequests = await leavesModel.find({
        employeeId: employee._id,
        status: 'approved',
      });

      // Initialize totalLeaveDays and totalLeaveDaysDeduction
      let totalLeaveDays = 0;
      let totalLeaveDaysDeduction = 0;

      leaveRequests.forEach((leaveRequest) => {
        leaveRequest.leaveDetails.forEach((leaveDetail) => {
          const leaveDate = new Date(leaveDetail.date);
          const leaveMonth = leaveDate.toLocaleString('default', {
            month: 'long',
          });
          const leaveYear = leaveDate.getFullYear();

          // Check if the leaveDetail's month and year match the provided month and year
          if (leaveMonth === salaryMonth && leaveYear === parseInt(salaryYear)) {
            let leaveDays = 1; // Default is 1 day
            if (leaveDetail.halfDay) {
              leaveDays = 0.5; // Adjust for half day leave
            }

            switch (leaveDetail.leaveType) {
              case 'LWP':
                totalLeaveDays += leaveDays;
                switch (leaveDetail.deductionType) {
                  case 0:
                    // No deduction, do nothing
                    break;
                  case 1:
                    totalLeaveDaysDeduction += leaveDays; // Deduct leave for deductionType 1
                    break;
                  case 2:
                    totalLeaveDaysDeduction += leaveDays * 2; // Deduct leave for deductionType 2
                    break;
                  default:
                    break;
                }
                break;

              case 'casual':
                totalLeaveDays += leaveDays;
                break;

              case 'personal':
                totalLeaveDays += leaveDays;
                break;

              case 'medical':
                totalLeaveDays += leaveDays;
                break;

              default:
                break;
            }
          }
        });
      });

      // Leave Calculation
      const perDaySalary = totalSalary / 31;
      const leaveDeductionAmount = parseFloat(
        (perDaySalary * totalLeaveDaysDeduction).toFixed(2)
      );

      const totalDeduction = tds + professionalTax + leaveDeductionAmount;

      const netSalary = totalSalary - totalDeduction;

      payrollEntries.push({
        employeeId: employee._id,
        employeeName: employee.name,
        salaryMonth,
        salaryYear,
        totalSalary,
        basicWage,
        HRA,
        conveyanceAllowance,
        medicalAllowance,
        da,
        otherAll,
        otherAllowance: [],
        tds,
        professionalTax,
        leaveDeductionAmount,
        totalEarning,
        totalDeduction,
        netSalary,
        totalLeaveDays,
        totalLeaveDaysDeduction,
        createdBy: 'system',
      });
    }

    // Insert or update payroll entries
    for (let entry of payrollEntries) {
      await Payroll.updateOne(
        {
          employeeId: entry.employeeId,
          salaryMonth: entry.salaryMonth,
          salaryYear: entry.salaryYear,
        },
        { $set: entry },
        { upsert: true }
      );
    }

    console.log(
      `Payroll generated successfully for ${salaryMonth} ${salaryYear}`
    );
  },{ timezone : 'Asia/Kolkata' });
});


// Generate Employee Salary
exports.generateEmployeeSalary = catchAsync(async (req, res, next) => {
  const { salaryMonth, salaryYear } = req.body;

  // Validate input parameters
  if (!salaryMonth || !salaryYear) {
    return res
      .status(400)
      .json({ message: 'Salary month and year are required.' });
  }

  // Ensure the salary year is a valid number
  if (
    isNaN(salaryYear) ||
    salaryYear < 1900 ||
    salaryYear > new Date().getFullYear()
  ) {
    return res.status(400).json({ message: 'Invalid salary year.' });
  }

  // Ensure the salary month is a valid string
  const validMonths = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  if (!validMonths.includes(salaryMonth)) {
    return res.status(400).json({ message: 'Invalid salary month.' });
  }

  // Fetch Employees Data
  const employees = await Employee.find({
    active: true,
    payrollEnable: true,
    salaryStatus: true,
    role: { $in: ['HR', 'Employee', 'Management'] },
  });

  if (!employees.length) {
    
    console.log('No eligible employees found for payroll generation');
    return res.status(404).json({ message: 'No eligible employees found.' });
  }

  // const existsPayroll = await Payroll.findOne({
  //     salaryMonth,
  //     salaryYear,
  // })

  // if (existsPayroll) {
  //   console.log(`Skipping ${existsPayroll.employeeName}: Payroll already generated for ${salaryMonth} ${salaryYear}`)
  //   return res.status(400).json({ message: `Payroll already generated for ${salaryMonth} ${salaryYear}` });
  // }

  const payrollEntries = [];

  for (let employee of employees) {
    const totalSalary = employee.totalSalary || 0;
    const basicWage = employee.basicWage || 0;
    const HRA = employee.HRA || 0;
    const conveyanceAllowance = employee.conveyanceAllowance || 0;
    const medicalAllowance = employee.medicalAllowance || 0;
    const da = employee.da || 0;
    const otherAll = employee.otherAllowance || 0;

    // const totalEarning =
    //   basicWage + HRA + conveyanceAllowance + medicalAllowance;

    const totalEarning = totalSalary;

    const tds = employee.tds || 0;
    const professionalTax = employee.professionalTax || 0;

    // LEAVE DEDUCTION CALCULATION

    // Fetch leave requests and filter leaveDetails for LWP
    const leaveRequests = await leavesModel.find({
      employeeId: employee._id,
      status: 'approved',
    });

    console.log(leaveRequests);
    

    // Initialize totalLeaveDays and totalLeaveDaysDeduction
    let totalLeaveDays = 0;
    let totalLeaveDaysDeduction = 0;

    leaveRequests.forEach((leaveRequest) => {
      leaveRequest.leaveDetails.forEach((leaveDetail) => {
        const leaveDate = new Date(leaveDetail.date);
        const leaveMonth = leaveDate.toLocaleString('default', {
          month: 'long',
        });
        const leaveYear = leaveDate.getFullYear();

        // Check if the leaveDetail's month and year match the provided month and year
        if (leaveMonth === salaryMonth && leaveYear === parseInt(salaryYear)) {
          let leaveDays = 1; // Default is 1 day
          if (leaveDetail.halfDay) {
            leaveDays = 0.5; // Adjust for half day leave
          }

          switch (leaveDetail.leaveType) {
            case 'LWP':
              totalLeaveDays += leaveDays;
              switch (leaveDetail.deductionType) {
                case 0:
                  // No deduction, do nothing
                  break;
                case 1:
                  totalLeaveDaysDeduction += leaveDays; // Deduct leave for deductionType 1
                  break;
                case 2:
                  totalLeaveDaysDeduction += leaveDays * 2; // Deduct leave for deductionType 2
                  break;
                default:
                  break;
              }
              break;

            case 'casual':
              totalLeaveDays += leaveDays;
              break;

            case 'personal':
              totalLeaveDays += leaveDays;
              break;

            case 'medical':
              totalLeaveDays += leaveDays;
              break;

            default:
              break;
          }
        }
      });
    });

    // Leave Calculation
    const perDaySalary = totalSalary / 31;
    const leaveDeductionAmount = parseFloat(
      (perDaySalary * totalLeaveDaysDeduction).toFixed(2)
    );

    const totalDeduction = tds + professionalTax + leaveDeductionAmount;

    const netSalary = totalSalary - totalDeduction;

    payrollEntries.push({
      employeeId: employee._id,
      employeeName: employee.name,
      salaryMonth,
      salaryYear,
      totalSalary,
      basicWage,
      HRA,
      conveyanceAllowance,
      medicalAllowance,
      da,
      otherAll,
      otherAllowance: [],
      tds,
      professionalTax,
      leaveDeductionAmount,
      totalEarning,
      totalDeduction,
      netSalary,
      totalLeaveDays,
      totalLeaveDaysDeduction,
      createdBy: req.user ? req.user.name : 'system',
    });
  }

  // Insert or update payroll entries
  for (let entry of payrollEntries) {
    await Payroll.updateOne(
      {
        employeeId: entry.employeeId,
        salaryMonth: entry.salaryMonth,
        salaryYear: entry.salaryYear,
      },
      { $set: entry },
      { upsert: true }
    );
  }

  console.log(
    `Payroll generated successfully for ${salaryMonth} ${salaryYear}`
  );
  return res
    .status(200)
    .json({ status: true, message: 'Payroll generated successfully' });

});

// exports.generateEmployeeSalary = catchAsync(async (req, res, next) => {
//   const { salaryMonth, salaryYear } = req.body;

//   // Validate input parameters
//   if (!salaryMonth || !salaryYear) {
//     return res.status(400).json({ message: 'Salary month and year are required.' });
//   }

//   // Validate year
//   if (isNaN(salaryYear) || salaryYear < 1900 || salaryYear > new Date().getFullYear()) {
//     return res.status(400).json({ message: 'Invalid salary year.' });
//   }

//   // Validate month
//   const validMonths = [
//     'January', 'February', 'March', 'April', 'May', 'June',
//     'July', 'August', 'September', 'October', 'November', 'December'
//   ];
//   if (!validMonths.includes(salaryMonth)) {
//     return res.status(400).json({ message: 'Invalid salary month.' });
//   }

//   // Fetch eligible employees
//   const employees = await Employee.find({
//     active: true,
//     payrollEnable: true,
//     salaryStatus: true,
//     role: { $in: ['HR', 'Employee', 'Management'] },
//   });

//   if (!employees.length) {
//     console.log('No eligible employees found for payroll generation');
//     return res.status(404).json({ message: 'No eligible employees found.' });
//   }

//   const payrollEntries = [];

//   for (let employee of employees) {
//     const totalSalary = employee.totalSalary || 0;
//     const basicWage = employee.basicWage || 0;
//     const HRA = employee.HRA || 0;
//     const conveyanceAllowance = employee.conveyanceAllowance || 0;
//     const medicalAllowance = employee.medicalAllowance || 0;
//     const totalEarning = totalSalary;
//     const tds = employee.tds || 0;
//     const professionalTax = employee.professionalTax || 0;

//     // Initialize leave deduction variables
//     let totalLeaveDays = 0;
//     let totalLeaveDaysDeduction = 0;
//     let leaveDeductionAmount = 0;

//     // Fetch approved leave requests for this employee
//     const leaveRequests = await leavesModel.find({
//       employeeId: employee._id,
//       status: 'approved',
//     });

//     // Process each leave request to calculate LWP deductions
//     leaveRequests.forEach((leaveRequest) => {
//       leaveRequest.leaveDetails.forEach((leaveDetail) => {
//         const leaveDate = new Date(leaveDetail.date);
//         const leaveMonth = leaveDate.toLocaleString('default', { month: 'long' });
//         const leaveYear = leaveDate.getFullYear();

//         // Check if leave is in the current payroll month/year
//         if (leaveMonth === salaryMonth && leaveYear === parseInt(salaryYear)) {
//           const isLWP = leaveDetail.leaveType === 'LWP';
//           const leaveDays = leaveDetail.halfDay ? 0.5 : 1;

//           // Count all leave days (for reporting)
//           totalLeaveDays += leaveDays;

//           // Only deduct for LWP leaves based on deductionType
//           if (isLWP) {
//             switch (leaveDetail.deductionType) {
//               case 1: // 1X deduction
//                 totalLeaveDaysDeduction += leaveDays;
//                 break;
//               case 2: // 2X deduction
//                 totalLeaveDaysDeduction += leaveDays * 2;
//                 break;
//               // case 0 means no deduction, so we skip
//             }
//           }
//         }
//       });
//     });

//     // Calculate leave deduction amount if there are LWP days to deduct
//     if (totalLeaveDaysDeduction > 0) {
//       const perDaySalary = totalSalary / 31; // Assuming 31 days in month
//       leaveDeductionAmount = parseFloat((perDaySalary * totalLeaveDaysDeduction).toFixed(2));
//     }

//     const totalDeduction = tds + professionalTax + leaveDeductionAmount;
//     const netSalary = totalSalary - totalDeduction;

//     payrollEntries.push({
//       employeeId: employee._id,
//       employeeName: employee.name,
//       salaryMonth,
//       salaryYear,
//       totalSalary,
//       basicWage,
//       HRA,
//       conveyanceAllowance,
//       medicalAllowance,
//       otherAllowance: [],
//       tds,
//       professionalTax,
//       leaveDeductionAmount,
//       totalEarning,
//       totalDeduction,
//       netSalary,
//       totalLeaveDays,
//       totalLeaveDaysDeduction,
//       createdBy: req.user ? req.user.name : 'system',
//     });
//   }

//   // Upsert payroll entries
//   for (let entry of payrollEntries) {
//     await Payroll.updateOne(
//       {
//         employeeId: entry.employeeId,
//         salaryMonth: entry.salaryMonth,
//         salaryYear: entry.salaryYear,
//       },
//       { $set: entry },
//       { upsert: true }
//     );
//   }

//   console.log(`Payroll generated successfully for ${salaryMonth} ${salaryYear}`);
//   return res.status(200).json({ 
//     status: true, 
//     message: 'Payroll generated successfully',
//     data: {
//       totalEmployees: payrollEntries.length,
//       totalLWPdeductions: payrollEntries.reduce((sum, entry) => sum + entry.leaveDeductionAmount, 0)
//     }
//   });
// });

// Old Employee Generate Salary
// exports.generateEmployeeSalary = catchAsync(async (req, res, next) => {
//   const { salaryMonth, salaryYear } = req.body;

//   // Fetch Employees Data
//   const employees = await Employee.find({
//     active: true,
//     payrollEnable: true,
//     salaryStatus: true,
//     role: { $in: ['HR', 'Employee', 'Management'] },
//   });

//   if (!employees.length) {
//     console.log('No eligible employees found for payroll generation');
//   }

//   const payrollEntries = employees.map((employee) => {
//     const totalSalary = employee.totalSalary || 0;
//     const basicWage = employee.basicWage || 0;
//     const HRA = employee.HRA || 0;
//     const conveyanceAllowance = employee.conveyanceAllowance || 0;
//     const medicalAllowance = employee.medicalAllowance || 0;

//     const otherAllowance = [];

//     const totalEarning =
//       basicWage + HRA + conveyanceAllowance + medicalAllowance;

//     const EPF = employee.EPF || 0;
//     const ESI_HealthInsurance = employee.ESI_HealthInsurance || 0;
//     const tds = employee.tds || 0;
//     const professionalTax = employee.professionalTax || 208;
//     const loanRecovery = employee.loanRecovery || 0;

//     // Calculate Leave Deduction
//     const leaveDeductionAmount = 0;

//     const totalDeduction =
//       EPF +
//       ESI_HealthInsurance +
//       tds +
//       professionalTax +
//       loanRecovery +
//       leaveDeductionAmount;

//     const netSalary = totalEarning - totalDeduction;

//     return {
//       employeeId: employee._id,
//       employeeName: employee.name,
//       salaryMonth,
//       salaryYear,
//       totalSalary,
//       basicWage,
//       HRA,
//       conveyanceAllowance,
//       medicalAllowance,
//       otherAllowance,
//       EPF,
//       tds,
//       professionalTax,
//       loanRecovery,
//       leaveDeductionAmount,
//       totalEarning,
//       totalDeduction,
//       netSalary,
//       createdBy: req.user ? req.user.name : 'system',
//     };
//   });

//   // Insert payroll entries into the database
//   //   await Payroll.insertMany(payrollEntries);

//   // Update or insert payroll entries
//   for (let entry of payrollEntries) {
//     await Payroll.updateOne(
//       {
//         employeeId: entry.employeeId,
//         salaryMonth: entry.salaryMonth,
//         salaryYear: entry.salaryYear,
//       },
//       { $set: entry },
//       { upsert: true } // upsert will insert a new record if no matching record is found
//     );
//   }

//   console.log(
//     `Payroll generated successfully for ${salaryMonth} ${salaryYear}`
//   );
// });


// }

// Get Generated Salary Records
exports.getEmployeeSalary = catchAsync(async (req, res, next) => {
  const { year, month, employeeName, page, pageSize } = req.query;
  const pageNum = parseInt(page) || 1;
  const size = parseInt(pageSize) || 10;
  const skip = (pageNum - 1) * size;

  const salaryMonth = moment().format('MMMM');
  const salaryYear = moment().year();

  // Build the query object based on provided filters
  const query = {};

  // Use provided year or current year as default
  query.salaryYear = year || salaryYear;

  // Use provided month or current month as default
  query.salaryMonth = month || salaryMonth;

  if (employeeName) {
    query.employeeName = { $regex: employeeName, $options: 'i' };
  }

  try {
    const totalItems = await Payroll.countDocuments(query);
    const payrollData = await Payroll.find(query).skip(skip).limit(size);

    return res.status(200).json({
      message: 'Payroll data retrieved successfully',
      payrollData,
      pageNum,
      totalItems,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Error retrieving payroll data',
      error: error.message,
    });
  }
});

exports.getEmployeeGeneratedSalaryById = catchAsync(async (req, res) => {
  const Id = req.params.id;

  try {
    // const Data = await Payroll.findOne({ _id: Id });

    const Data = await Payroll.findOne({ _id: Id }).populate('employeeId');


    if (!Data) {
      return res.status(404).json({ message: 'Data not found.' });
    }

    res.json(Data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

exports.updateGeneratedSalary = catchAsync(async (req, res, next) => {
  const generatedSalaryId = req.params.id;

  // Extract the fields you want to update from the request body
  let {
    basicWage,
    HRA,
    conveyanceAllowance,
    medicalAllowance,
    da,
    otherAll,
    otherAllowance,
    EPF,
    ESI_HealthInsurance,
    professionalTax,
    loanRecovery,
    leaveDeductionAmount,
    totalEarning,
    totalDeduction,
    netSalary,
  } = req.body;

  try {
    // Check if the pay slip exists
    const generatedSalaryData = await Payroll.findById(generatedSalaryId);

    if (!generatedSalaryData) {
      return next(new AppError('Generated Data not found!', 404));
    }

    // Update the pay slip fields with the new values
    generatedSalaryData.basicWage = basicWage;
    generatedSalaryData.HRA = HRA;
    generatedSalaryData.conveyanceAllowance = conveyanceAllowance;
    generatedSalaryData.medicalAllowance = medicalAllowance;
    generatedSalaryData.da = da;
    generatedSalaryData.otherAll = otherAll;
    generatedSalaryData.otherAllowance = otherAllowance;
    generatedSalaryData.EPF = EPF;
    generatedSalaryData.ESI_HealthInsurance = ESI_HealthInsurance;
    generatedSalaryData.professionalTax = professionalTax;
    generatedSalaryData.loanRecovery = loanRecovery;
    generatedSalaryData.leaveDeductionAmount = leaveDeductionAmount;
    generatedSalaryData.totalEarning = totalEarning;
    generatedSalaryData.totalDeduction = totalDeduction;
    generatedSalaryData.netSalary = netSalary;

    // Save the updated pay slip
    const updatedGenerateddata = await generatedSalaryData.save();
    res.status(200).json(updatedGenerateddata);
  } catch (err) {
    console.error(err);
    return next(new AppError('Error updating salary data', 401));
  }
});

// exports.testCron = catchAsync(async (req, res, next) => {
//   cron.schedule('49 14 17 1 *', async () => {

    

//   });
// });
