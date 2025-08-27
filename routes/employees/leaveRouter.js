const express = require('express');
const authController = require('../../controller/AuthController');
const LeaveController = require("../../controller/leaveController");
const Controller = require('../../controller/paidLeaveController');
const router = express.Router();


//Protect all routes after this middleware
router.use(authController.protect);

router.get('/get-All/leave-request', LeaveController.getEmployeeLeaveRequest);
router.get('/get/leave-request/:id', LeaveController.getLeaveRequestById);

router.get('/get/employees/paidLeaves/:id', authController.restrictTo('HR','Employee', 'Management','TeamLead'), Controller.getEmployeePaidLeaveById);

router.get(
  '/getSingleEmployeeLeaveRequest/:id',
  authController.restrictTo('Employee', 'Management','TeamLead','HR','Admin'),
  LeaveController.getSingleEmployeeLeaveRequestAdmin
);

router.post(
  '/create/leave-request',
  authController.restrictTo('Employee', 'Management','TeamLead'),
  LeaveController.leaveRequest
);
router.post(
  '/update/leave-request/:id',
  authController.restrictTo('Employee', 'Management','TeamLead'),
  LeaveController.updateLeaveRequest
);
router.post(
  '/delete/leave-request/:id',
  authController.restrictTo('Employee', 'Management','TeamLead'),
  LeaveController.deleteLeaveRequest
);

router.get(
  '/getAll/employees/pending-leave-request',
  authController.restrictTo('Management','TeamLead'),
  LeaveController.getAllEmployeePendingLeaveRequests
);

router.get(
  '/getAll/employees/employeesOnLeave',
  authController.restrictTo('Management','TeamLead'),
  LeaveController.employeesOnLeave
);

module.exports = router;