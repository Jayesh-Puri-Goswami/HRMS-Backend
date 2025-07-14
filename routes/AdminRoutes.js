const express = require('express');
const adminRouter = require("./admin/admin.router");
const leaveReqRouter = require("./admin/leaveReq.router");
const paidLeaveRouter = require("./admin/paidLeave.router");
const payrollRouter = require('./admin/payroll.router');
const shiftRouter = require('./admin/shift.router');
const policyRouter = require('./admin/policy.router');
const noticeRouter = require('./admin/notice.router');
const agreementRouter = require('./admin/agreement.router');
const holidayRouter = require('./admin/holiday.router');
const complainRouter = require('./admin/complain.router');
const eventRouter = require('./admin/event.router')
const router = express.Router();

router.use(
  '/admin',
  adminRouter,
  leaveReqRouter,
  paidLeaveRouter,
  payrollRouter,
  shiftRouter,
  policyRouter,
  noticeRouter,
  agreementRouter,
  holidayRouter,
  eventRouter,
  complainRouter
);

module.exports = router;
