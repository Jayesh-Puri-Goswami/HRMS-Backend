const express = require('express');
const authController = require('../../controller/AuthController');
const complainController = require('../../controller/complainsController')

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);


router.get('/complain/getAllComplain/:employeeId', authController.restrictTo('Employee', 'Management','TeamLead'), complainController.getComplaints )


router.post('/complain/createComplain', authController.restrictTo('Employee', 'Management','TeamLead'), complainController.createComplain )



module.exports = router;