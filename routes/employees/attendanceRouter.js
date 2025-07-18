const express = require('express');
const authController = require('../../controller/AuthController');
const AttendanceController = require("../../controller/attandanceController");

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// For Employees

router.get('/check-in', authController.restrictTo('Employee', 'Management','TeamLead','HR'), AttendanceController.checkIn);

router.get(
  '/check-out',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.checkOut
);

router.get(
  '/pauseTracker',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.pauseTracker
);
router.get(
  '/resumeTracker',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.resumeTracker
);

router.get(
  '/startLunch',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.startLunch
);
router.get(
  '/endLunch',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.endLunch
);
router.get(
  '/startBreak',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.startBreak
);
router.get(
  '/endBreak',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.endBreak
);


router.get(
  '/attendance',  
  authController.restrictTo('Employee', 'Management','TeamLead'),
  AttendanceController.getEmployeeAttendance
);

router.get(
  '/today/attendance',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.getEmployeeTodayAttendance
);

router.get(
  '/monthly/attendance',
  authController.restrictTo('Employee', 'Management','TeamLead'),
  AttendanceController.getEmployeeMonthlyAttendance
)

router.post(
  '/updateProfile',
  authController.restrictTo('Employee', 'Management','TeamLead'),
  authController.uploadDocuments,
  authController.storeDocuments,
  AttendanceController.updateEmployeeProfile
);


module.exports = router;