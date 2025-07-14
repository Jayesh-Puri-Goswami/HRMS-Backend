const express = require('express');
const adminController = require('../../controller/adminController');
const shiftController = require('../../controller/shiftController');
const authController = require('../../controller/AuthController');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

router.post('/create/shift', shiftController.createShift);

router.post('/updateShift/:id', shiftController.updateShift);

router.get('/getAll/Shifts', shiftController.getAllShifts);



module.exports = router;
