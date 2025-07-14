const express = require('express');
const router = express.Router();
const Controller = require('../../controller/paidLeaveController');
const authController = require('../../controller/AuthController');

// Protect all routes after this middleware
router.use(authController.protect);

router.get('/getAll/employees/padiLeaves', authController.restrictTo('Admin','HR'), Controller.getAllEmployeePaidLeave);
router.get('/get/employees/paidLeaves/:id', authController.restrictTo('Admin','HR'), Controller.getEmployeePaidLeaveById);
router.post('/update/padi-Leave/:id', authController.restrictTo('Admin','HR'), Controller.updateEmployeePaidLeaveById);

module.exports = router;