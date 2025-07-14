const express = require('express');
const authController = require('../../controller/AuthController');
const NoticeController = require("../../controller/noticeController");

const router = express.Router();

//Protect all routes after this middleware
router.use(authController.protect);

router.get('/notice/getAllNotices', NoticeController.getAllNoticesEmployee);
router.get('/notice/getNoticeById/:id', NoticeController.getNoticeByIdEmployee);
router.get('/notice/raiseQuery/:id', NoticeController.raiseQueryEmployee);

// router
//     .route('/getAllAssignedEmployees')
//     .get(
//     authController.restrictTo('Management'),
//     ManagerController.getAllAssignedEmployees
// );

// router.get(
//   '/getSingleEmployeeLeaveRequestManager/:id',
//   authController.restrictTo('Management'),
//   ManagerController.getSingleEmployeeLeaveRequestManager
// );

// router.get(
//   '/getParticularEmployeeLeaveBalance/:id',
//   authController.restrictTo('Management'),
//   ManagerController.getEmployeePaidLeaveById
// );

// router.post(
//   '/performManagerLeaveAction/:id',
//   authController.restrictTo('Management'),
//   ManagerController.performManagerLeaveAction
// );

module.exports = router;