const express = require('express');
const EmployeeRouter = require("./employees/attendanceRouter");
const LeaveReqRouter = require("./employees/leaveRouter");
const payslipRouter = require("./employees/payslipRouter");
const queryRouter = require("./employees/queryRouter")
const paidLeaves = require('./employees/paidLeave.router');
const resignation = require('./employees/resignationRouter');
const manager = require('./employees/managerRouter');
const notice = require('./employees/notice.router');
const employeeRouter = require('./employees/employeeRouter');
const complainRouter = require('./employees/complainRouter')
const holidayRouter = require('./employees/holidayRouter')
const dashboardRouter = require('./employees/dashboardRouter')
const eventRouter = require('./employees/eventRouter')

const router = express.Router();

router.use(
  '/employee',
  EmployeeRouter,
  LeaveReqRouter,
  payslipRouter,
  queryRouter,
  paidLeaves,
  resignation,
  manager,
  notice,
  employeeRouter,
  complainRouter,
  holidayRouter,
  eventRouter,
  dashboardRouter
);

module.exports = router;
