const express = require('express');
const adminController = require('../../controller/adminController');
const authController = require('../../controller/AuthController');
const noticeController = require('../../controller/noticeController');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

router.post('/notice/create', noticeController.createNotice);

router.post('/notice/update/:id', noticeController.updateNotice);

router.get('/notice/getAll', noticeController.getAllNotices);

router.get('/noticeEmployee/:id', noticeController.getUserInfoById);


router.get('/notice/getNoticeById/:id', noticeController.getNoticeById);

router.delete('/notice/delete/:id', noticeController.deleteNotice);


module.exports = router;
