const express = require('express');
const router = express.Router();
const Controller = require('../../controller/paidLeaveController');
const authController = require('../../controller/AuthController');

// Protect all routes after this middleware
router.use(authController.protect);

router.get(
  '/getAll/employees/paidLeaves',
  authController.restrictTo('Employee', 'Management','TeamLead'),
  Controller.getEmployeePaidLeave
);

module.exports = router;