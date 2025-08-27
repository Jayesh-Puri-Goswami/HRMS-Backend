const express = require('express');
const authController = require('../../controller/AuthController');
const paySlipController = require("../../userController/paySlipController");

const router = express.Router();


router.use(authController.protect);

router.get(
  '/get/employee-payslip',
  authController.restrictTo('Employee', 'Management','TeamLead', 'HR'),
  paySlipController.getPaySlipByEmployee
);

router.get(
  '/get/employee-payslipById/:id',
  authController.restrictTo('Employee', 'Management','TeamLead', 'HR'),
  paySlipController.getPaySlipByEmployee
);
router.get(
  '/get/pay-slip/:id',
  authController.restrictTo('Employee', 'Management','TeamLead', 'HR'),
  paySlipController.getEmployeePaySlipById
);
module.exports = router;