const express = require('express');
const authController = require('../../controller/AuthController');
const { getAllHolidays } = require('../../controller/holidaysController');

const router = express.Router();

router.use(authController.protect);

// Route to get all holidays

router.get('/holidays/allHolidays', authController.restrictTo('Employee', 'Management','TeamLead'),getAllHolidays )


module.exports = router;