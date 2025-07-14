const express = require('express');
const adminController = require('../../controller/adminController');
const AgreementController = require('../../controller/AgreementController');
const authController = require('../../controller/AuthController');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

router.post(
  '/agreement/create',
  upload.single('file'),
  AgreementController.createAgreement
);
router.put(
  '/agreement/update/:id',
  upload.single('file'),
  AgreementController.updateAgreement
);
router.get('/agreement/getAll', AgreementController.getAllAgreements);

router.get('/agreement/get/:id', AgreementController.getAgreementById);

router.delete('/agreement/delete/:id', AgreementController.deleteAgreement);



module.exports = router;
