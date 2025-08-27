const express = require('express');
const authController = require('../../controller/AuthController');
const AttendanceController = require("../../controller/attandanceController");

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// For Employees

router.get('/getDashboardData', authController.restrictTo('Employee', 'Management','TeamLead','HR'), AttendanceController.getDashboardData );

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
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.getEmployeeAttendance
);
router.get(
  '/attendanceById/:id',  
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
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
);

router.get(
  '/attendance/summary',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  AttendanceController.getEmployeeAttendanceSummary
);

router.get(
  '/hr/attendance/summary',
  authController.restrictTo('HR', 'Admin'),
  AttendanceController.getHrAttendanceSummary
);



// Enhanced profile update with image upload support
const multer = require('multer');
const path = require('path');

// Configure multer for profile image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/img/users/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  }
});

const uploadProfile = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.fieldname === 'profile_image') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for profile picture'), false);
      }
    } else {
      cb(null, true);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).fields([
  { name: 'profile_image', maxCount: 1 },
  { name: 'aadhaarCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'voterId', maxCount: 1 },
  { name: 'photograph', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'otherDocument', maxCount: 1 },
  { name: 'recentMarksheet', maxCount: 1 }
]);

router.put(
  '/updateProfile',
  authController.restrictTo('Employee', 'Management','TeamLead','HR'),
  uploadProfile,
  AttendanceController.updateEmployeeProfile
);


module.exports = router;