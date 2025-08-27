const express = require('express');
const router = express.Router();
const authController = require('../../controller/AuthController');
const attendanceController = require('../../controller/attandanceController');

router.get(
  '/attendance/summary',
  authController.restrictTo('HR', 'Admin'),
  attendanceController.getHrAttendanceSummary
);

router.get(
  '/attendance/employee/list',
  authController.restrictTo('HR', 'Admin'),
  attendanceController.getEmployeeList
);

router.get(
  '/attendance/employee/:id',
  authController.restrictTo('HR', 'Admin'),
  attendanceController.getEmployeeAttendanceById
);

router.get(
  '/attendance/export/month',
  authController.restrictTo('HR', 'Admin'),
  attendanceController.exportMonthlyAttendance
);

router.get(
  '/attendance/today/leave/employee',
  authController.restrictTo('HR', 'Admin'),
  attendanceController.getTodayLeaveEmployee
);

router.get(
  '/attendance/today/absent/employee',
  authController.restrictTo('HR', 'Admin'),
  attendanceController.getTodayAbsentEmployee
);

router.get(
  '/attendance/today/late/employee',
  authController.restrictTo('HR', 'Admin'),
  attendanceController.getTodayLateEmployee
);

router.get(
  '/attendance/most/leave/absent/employee',
  authController.restrictTo('HR', 'Admin'),
  attendanceController.getMostLeaveAndAbsentEmployee
);

module.exports = router;
