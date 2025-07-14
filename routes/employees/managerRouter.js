const express = require('express');
const authController = require('../../controller/AuthController');
const ManagerController = require("../../controller/managerController");

const router = express.Router();

//Protect all routes after this middleware
router.use(authController.protect);

router
    .route('/getAllAssignedEmployees')
    .get(
    authController.restrictTo('Management','TeamLead'),
    ManagerController.getAllAssignedEmployees
);

router.get(
  '/getSingleEmployeeLeaveRequestManager/:id',
  authController.restrictTo('Management','TeamLead'),
  ManagerController.getSingleEmployeeLeaveRequestManager
);

router.get(
  '/getParticularEmployeeLeaveBalance/:id',
  authController.restrictTo('Management','TeamLead'),
  ManagerController.getEmployeePaidLeaveById
);

router.post(
  '/performManagerLeaveAction/:id',
  authController.restrictTo('Management','TeamLead'),
  ManagerController.performManagerLeaveAction
);

module.exports = router;