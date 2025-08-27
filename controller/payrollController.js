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
  cron.schedule(
    '0 0 1 * *',
    async () => {
      const today = moment();
      const isLastDayOfMonth = today.isSame(
        today.clone().endOf('month'),
        'day'
      );
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
            if (
              leaveMonth === salaryMonth &&
              leaveYear === parseInt(salaryYear)
            ) {
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
    },
    { timezone: 'Asia/Kolkata' }
  );
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

  const existsPayroll = await Payroll.findOne({
    salaryMonth,
    salaryYear,
  });

  if (existsPayroll) {
    return res
      .status(400)
      .json({
        message: `Payroll already generated for ${salaryMonth} ${salaryYear}`,
      });
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


// Get Generated Salary Records
exports.getEmployeeSalary = catchAsync(async (req, res, next) => {
  const { year, month, employeeName, page, pageSize } = req.query;
  const pageNum = parseInt(page) || 1;
  const size = parseInt(pageSize) || 100;
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
    const payrollData = await Payroll.find(query).sort({ employeeName: 1 }).skip(skip).limit(size);

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

exports.getEmployeeGeneratedSalaryById = catchAsync(async (req, res, next) => {

  const Id = req.params.id;
  
  try {
    const payrollDoc = await Payroll.findOne({ _id: Id }).populate('employeeId');
    if (!payrollDoc) {
      return res.status(404).json({ message: 'Data not found.' });
    }

    const employeeId = payrollDoc.employeeId?._id || payrollDoc.employeeId;
    const month = payrollDoc.salaryMonth;
    const year = payrollDoc.salaryYear;

    // Fetch leave summary for the given employee/month/year
    let leaveSummary = null;
    try {
      const leaveController = require('./leaveController');
      if (leaveController && typeof leaveController.getEmployeeLeaveDetailsOfMonthAndYear === 'function') {
        // Call underlying logic directly via model to avoid express 'req/res' dependency
        // Reuse their logic by querying leaves model similarly here
        const leavesModel = require('../model/leaves.model');
        // Compute month bounds similar to leaveController
        const monthIndex = new Date(Date.parse(month + ' 1, ' + year)).getMonth();
        const startOfMonth = new Date(year, monthIndex, 1);
        const endOfMonth = new Date(year, monthIndex + 1, 0);

        // Get all approved leaves for this employee
        const allApprovedLeaves = await leavesModel.find({
          employeeId: employeeId,
          status: 'approved',
        });

        const leaveCountMonth = { month, casual: 0, personal: 0, medical: 0, LWP: 0 };
        
        // Filter leave details by actual leave dates that fall in the salary month
        allApprovedLeaves.forEach((leave) => {
          leave.leaveDetails.forEach((leaveDetail) => {
            const leaveDate = new Date(leaveDetail.date);
            // Check if this specific leave date falls within the salary month
            if (leaveDate >= startOfMonth && leaveDate <= endOfMonth) {
              if (['casual', 'personal', 'medical', 'LWP'].includes(leaveDetail.leaveType)) {
                if (leaveDetail.halfDay) leaveCountMonth[leaveDetail.leaveType] += 0.5;
                else leaveCountMonth[leaveDetail.leaveType] += 1;
              }
            }
          });
        });

        // Financial year (April to March)
        const currentDate = new Date();
        let financialYearStart, financialYearEnd;
        if (currentDate.getMonth() >= 3) {
          financialYearStart = new Date(currentDate.getFullYear(), 3, 1);
          financialYearEnd = new Date(currentDate.getFullYear() + 1, 2, 31);
        } else {
          financialYearStart = new Date(currentDate.getFullYear() - 1, 3, 1);
          financialYearEnd = new Date(currentDate.getFullYear(), 2, 31);
        }

        const leaveCountYear = { year, casual: 0, personal: 0, medical: 0, LWP: 0 };
        
        // Filter leave details by actual leave dates that fall in the financial year
        allApprovedLeaves.forEach((leave) => {
          leave.leaveDetails.forEach((leaveDetail) => {
            const leaveDate = new Date(leaveDetail.date);
            // Check if this specific leave date falls within the financial year
            if (leaveDate >= financialYearStart && leaveDate <= financialYearEnd) {
              if (['casual', 'personal', 'medical', 'LWP'].includes(leaveDetail.leaveType)) {
                if (leaveDetail.halfDay) leaveCountYear[leaveDetail.leaveType] += 0.5;
                else leaveCountYear[leaveDetail.leaveType] += 1;
              }
            }
          });
        });

        leaveSummary = { leaveCountMonth, leaveCountYear };
      }
    } catch (e) {
      // Non-fatal: keep leaveSummary null if any error
      leaveSummary = null;
    }

    // Fetch attendance summary for the payslip's month/year
    let attendanceSummary = null;
    try {
      const AttendanceModel = require('../model/attendance.model');
      const moment = require('moment-timezone');
      const TZ = 'Asia/Kolkata';
      const monthIndexForAttendance = new Date(Date.parse(month + ' 1, ' + year)).getMonth();
      const startOfMonth = moment.tz({ year: Number(year), month: monthIndexForAttendance, day: 1 }, TZ)
        .startOf('month')
        .startOf('day')
        .toDate();
      const endOfMonth = moment(startOfMonth).tz(TZ).endOf('month').endOf('day').toDate();

      const attendanceRecords = await AttendanceModel.find({
        employeeId: employeeId,
        date: { $gte: startOfMonth, $lte: endOfMonth },
      });

      const attendanceByDate = {};
      attendanceRecords.forEach((record) => {
        const dateKey = moment(record.date).tz(TZ).format('YYYY-MM-DD');
        attendanceByDate[dateKey] = record.status;
      });

      const totalWorkingDays = [];
      let current = moment(startOfMonth).tz(TZ);
      while (current <= moment(endOfMonth).tz(TZ)) {
        const day = current.day();
        if (day !== 0 && day !== 6) {
          totalWorkingDays.push(current.format('YYYY-MM-DD'));
        }
        current = current.add(1, 'day');
      }

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let notInOfficeCount = 0;
      let leaveCount = 0;
      let halfDayCount = 0;
      totalWorkingDays.forEach((date) => {
        if (attendanceByDate[date] === 'present') presentCount++;
        else if (attendanceByDate[date] === 'absent') absentCount++;
        else if (attendanceByDate[date] === 'late') lateCount++;
        else if (attendanceByDate[date] === 'not_in_office') notInOfficeCount++;
        else if (attendanceByDate[date] === 'leave') leaveCount++;
        else if (attendanceByDate[date] === 'halfDay') halfDayCount++;
      });

      attendanceSummary = {
        employeeId,
        totalWorkingDays: totalWorkingDays.length,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        notInOffice: notInOfficeCount,
        leave: leaveCount,
        halfDay: halfDayCount,
      };
    } catch (e) {
      attendanceSummary = null;
    }

    return res.json({
      ...payrollDoc.toObject(),
      leaveSummary,
      attendanceSummary,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
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

exports.getEmployeeSalaryById = catchAsync(async (req, res, next) => {
  const { year, month, page, pageSize } = req.query;
  const employeeId = req.params.id || req.query.id;
  const pageNum = parseInt(page) || 1;
  const size = parseInt(pageSize) || 100;
  const skip = (pageNum - 1) * size;

  if (!employeeId) {
    return res.status(400).json({ message: 'Employee ID is required' });
  }

  const salaryMonth = month || moment().format('MMMM');
  const salaryYear = year || moment().year();

  const query = {
    employeeId: employeeId,
    salaryYear: salaryYear,
    salaryMonth: salaryMonth,
  };

  // Remove month/year from query if not provided
  if (!month) delete query.salaryMonth;
  if (!year) delete query.salaryYear;

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

// exports.testCron = catchAsync(async (req, res, next) => {
//   cron.schedule('49 14 17 1 *', async () => {

//   });
// });
