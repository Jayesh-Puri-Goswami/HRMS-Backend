const express = require('express');
const {getComplaintsAdmin, updateComplaintStatus} = require('../../controller/complainsController')
const authController = require('../../controller/AuthController');


const router = express.Router()

router.use(authController.protect)

// Route to get complaint
router.get('/allComplaint', authController.restrictTo('Admin','HR'), getComplaintsAdmin )

router.put('/updateComplain', authController.restrictTo('Admin','HR'), updateComplaintStatus)

module.exports = router;
