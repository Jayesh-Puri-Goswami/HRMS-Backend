const express = require('express');
const adminController = require('../../controller/adminController');
const attendanceController = require('../../controller/attandanceController');
const authController = require('../../controller/AuthController');
const paySlipController = require('../../controller/paySlipController');
const payrollController = require('../../controller/payrollController');

const router = express.Router();

// Generate Employee Salary
router.post(
  '/payroll/generateEmployeeSalary',
  payrollController.generateEmployeeSalary
);

// Get Employee Generated Salary
router.get('/payroll/getEmployeeSalary', payrollController.getEmployeeSalary);

router
  .route('/payroll/generated-salary/:id')
  .get(
    authController.restrictTo('Admin', 'HR'),
    payrollController.getEmployeeGeneratedSalaryById
  );

router
  .route('/payroll/update-generated-salary/:id')
  .post(
    authController.restrictTo('Admin', 'HR'),
    payrollController.updateGeneratedSalary
  );

module.exports = router;
