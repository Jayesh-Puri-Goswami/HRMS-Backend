const express = require('express');
const authController = require('../../controller/AuthController');
const dashboardController = require('../../controller/dashboardController')

const router = express.Router();

// Protect all routes after this middleware

router.use(authController.protect);

router.get('/dashboard/getAdminDashboard',authController.restrictTo('Admin','HR'), dashboardController.getEmployeeData)


// router.get('/getEmployeeByUser',authController.restrictTo('Employee','Management','TeamLead'),dashboardController.getEmployeeByRole)


module.exports = router;