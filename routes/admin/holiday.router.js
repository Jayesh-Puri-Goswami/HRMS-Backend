const express = require('express');
const { getAllHolidays, createHolidays, updateHolidays, deleteHoliday } = require('../../controller/holidaysController');
const authController = require('../../controller/AuthController');

const router = express.Router();

// Get all Holidays only for all employees
router.get('/allHolidays', 
    getAllHolidays )

// Create Holidays only for admin and HR
router.post('/createHolidays', authController.restrictTo('Admin', 'HR') , createHolidays )

// Update Holidays only for admin and HR
router.put('/updateHolidays', authController.restrictTo('Admin', 'HR') , updateHolidays )


// delete Holidays only for admin and HR
router.delete('/deleteHoliday/:holidayId', authController.restrictTo('Admin', 'HR') , deleteHoliday )




module.exports = router;
// Compare this snippet from controller/holidaysController.js: