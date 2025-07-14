const express = require('express');
const authController = require('../../controller/AuthController');
const AgreementController = require("../../controller/AgreementController");

const router = express.Router();

//Protect all routes after this middleware
router.use(authController.protect);

router.get(
  '/agreement/getEmployeeAllAgreement',
  AgreementController.getEmployeeAllAgreement
);




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