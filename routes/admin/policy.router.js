const express = require('express');
const adminController = require('../../controller/adminController');
const authController = require('../../controller/AuthController');
const policyController = require('../../controller/policyController');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

router.post(
  '/policy/create',
  upload.single('file'),
  policyController.createPolicy
);

router.post(
  '/policy/update/:id',
  upload.single('file'),
  policyController.updatePolicy
);

router.delete('/policy/delete/:id',policyController.deletePolicies)

router.get('/policy/getAll', policyController.getAllPolicies);


module.exports = router;
