const express = require('express');
const adminController = require('../../controller/adminController');
const attendanceController = require('../../controller/attandanceController');
const authController = require('../../controller/AuthController');
const paySlipController = require('../../controller/paySlipController');

const dashboardController = require('../../controller/dashboardController')

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();



router.post('/signup', authController.signup);

router.post('/Adminsignup', authController.signupForAdmin);

router.post('/login', authController.login);


router.post('/forgot-password', authController.forgotPassword);

router.patch('/resetPassword/:token', authController.resetPassword);

// router.post('/login', authController.login);


// Protect all routes after this middleware
router.use(authController.protect);

router.patch('/updateMyPassword', authController.updatePassword);
router.get('/me',adminController.getMe, adminController.getUser);
router.patch(
  '/updateMe',
  adminController.uploadUserPhoto,
  adminController.resizeUserPhoto,
  adminController.updateMe
);
router.patch(
  '/updateData',
  adminController.uploadDocuments,
  adminController.resizeDocuments,  
  adminController.updateData
);
router.post('/updateProfile', adminController.updateProfile);

router.delete('/deleteMe', adminController.deleteMe);

//------------------------------ Management Router --------------------------//

router
  .route('/getAll-managements/details')
  .get(authController.restrictTo('Admin'), adminController.getAllManagement);

router
  .route('getUser/:id')
  .get(authController.restrictTo('Admin'), adminController.getUser)
  .patch(authController.restrictTo('Admin'), adminController.updateUser)
  .put(authController.restrictTo('Admin'), adminController.deleteUser);

//---------------------------------------- END -----------------------------------//



//------------------------------ Employees Router --------------------------//

router.post(
  '/add-employee',
  authController.restrictTo('Admin', 'HR'),
  authController.uploadDocuments,
  authController.storeDocuments,
  authController.signup
);



router.post(
  '/edit-employee/:id',
  authController.restrictTo('Admin', 'HR'),
  authController.uploadDocuments,
  authController.storeDocuments,
  authController.editEmployee
);

router
  .route('/getAll-employees/data')
  .get(authController.restrictTo('Admin', 'HR'), adminController.getAllUsers);

router
  .route('/getAll-managers/data')
  .get(authController.restrictTo('Admin', 'HR'), adminController.getAllManagers);

router
  .route('/getAll-employees/details')
  .get(
    authController.restrictTo('Admin', 'HR'),
    adminController.getAllEmployee
  );

  router
  .route('/employee/count')
  .get(
    authController.restrictTo('Admin', 'HR'),
    adminController.getAllEmployeeCount
  );

  router
  .route('/getEmployeeCounts/ByType')
  .get(
    authController.restrictTo('Admin', 'HR'),
    adminController.getEmployeeCountsByType
  );

router
  .route('/employee/:id')
  .get(authController.restrictTo('Admin', 'HR'), adminController.getUser)
  .patch(authController.restrictTo('Admin', 'HR'), adminController.updateUser)
  .put(authController.restrictTo('Admin', 'HR'), adminController.deleteUser);

router
  .route('/probation/:id')
  .put(
    authController.restrictTo('Admin', 'HR'),
    adminController.updateProbation
  );

router
  .route('/all-attendance/today')
  .get(
    authController.restrictTo('Admin', 'HR'),
    attendanceController.getTodayAllEmployeeAttendance
  );

router
  .route('/allAttendance/employee')
  .get(
    authController.restrictTo('Admin', 'HR'),
    attendanceController.getAllEmployeeAttendance
  );

  // router.get('/getAttendanceByID/:id',
  //   authController.restrictTo('Admin','HR'),
  //   attendanceController.getAttendanceByID
  // )

router.get('/getAttendanceById/:id',authController.restrictTo('Admin','HR'),attendanceController.getAttendanceByID)
router.put('/updateAttendanceById/:id',authController.restrictTo('Admin','HR'),attendanceController.updateAttendanceById);

router.get('/getEmployeeStats/:id',attendanceController.getEmployeeStats)

router
  .route('/allAttendance/exportAttendance')
  .get(
    authController.restrictTo('Admin', 'HR'),
    attendanceController.exportAttendance
  );

//---------------------------------------- END -----------------------------------//

router
  .route('/create/pay-slip')
  .post(
    authController.restrictTo('Admin', 'HR'),
    paySlipController.generatePaySlip
  );

  router
  .route('/update/pay-slip/:id')
  .post(
    authController.restrictTo('Admin', 'HR'),
    paySlipController.updatePaySlip
  );

router
  .route('/getAll/pay-slip')
  .get(
    authController.restrictTo('Admin', 'HR'),
    paySlipController.getEmployeesPaySlip
  );

  router
  .route('/get/pay-slip/:id')
  .get(
    authController.restrictTo('Admin', 'HR'),
    paySlipController.getEmployeePaySlipById
  );

  router
  .route('/get/paySlip-data/:id')
  .get(
    authController.restrictTo('Admin', 'HR'),
    paySlipController.getEmplpoyeePaySlip_Data
  );

  router
  .route('/deletePaySlip/:id')
  .post(
    authController.restrictTo('Admin', 'HR'),
    paySlipController.deletePaySlip
  );

router
  .route('/change-password')
  .post(
    authController.restrictTo('Admin', 'HR'),
    adminController.changePassword
);


//**** Dashboard API's *************/

// Get Today Attendance Count
router.get(
  '/dashboard/getTodayAttendanceCount',
  authController.restrictTo('Admin', 'HR'),
  attendanceController.getTodayAttendanceCount
);

// Get Today Attendance Count
router.get(
  '/dashboard/getTodayLeaveData',
  authController.restrictTo('Admin', 'HR'),
  attendanceController.getTodayLeaveCount
);


// Get employee by user 

router.get('/getEmployeeByUser',authController.restrictTo('Admin','HR'),dashboardController.getEmployeeByRole)


module.exports = router;
