const express = require('express');
const router = express.Router();
const leaveReqController = require('../../controller/leaveController');
const authController = require('../../controller/AuthController');

// Protect all routes after this middleware
router.use(authController.protect);

router.get(
  '/getSingleEmployeeLeaveRequestAdmin/:id',
  authController.restrictTo('Admin', 'HR'),
  leaveReqController.getSingleEmployeeLeaveRequestAdmin
);

router.get('/getAll/employees/leave-request', authController.restrictTo('Admin','HR'), leaveReqController.getAllEmployeeLeaveRequests);

router.post('/delete/leave-request/:id', authController.restrictTo('Admin','HR'), leaveReqController.deleteLeaveRequestForAdmin);

router.post('/manage/leave-request/:id', authController.restrictTo('Admin','HR','Management','TeamLead'), leaveReqController.manageLeaveRequest);

router.post(
  '/manage/leave-request-action-admin/:id',
  authController.restrictTo('Admin', 'HR'),
  leaveReqController.leaveRequestActionAdmin
);

router.post(
  '/manage/update-leave-request-admin/:id',
  authController.restrictTo('Admin', 'HR'),
  leaveReqController.updateLeaveRequestAdmin
);

router.get(
  '/getEmployeeLeaveDetailsOfMonthAndYear/:id',
  authController.restrictTo('Admin', 'HR'),
  leaveReqController.getEmployeeLeaveDetailsOfMonthAndYear
);

module.exports = router;