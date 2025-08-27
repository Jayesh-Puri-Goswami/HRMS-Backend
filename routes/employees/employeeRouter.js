const express = require('express');
const authController = require('../../controller/AuthController');
const AgreementController = require("../../controller/AgreementController");
const addressController = require('../../controller/adminController')
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminController = require('../../controller/adminController');
const payrollController = require('../../controller/payrollController');

// Use memory storage for multer
const upload = multer({ storage: multer.memoryStorage() });

// Helper middleware to store files in public/employee-documents
const storeEmployeeDocuments = async (req, res, next) => {
  if (!req.files) return next();
  const promises = [];
  Object.keys(req.files).forEach((field) => {
    const file = req.files[field][0];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const filename = `user-${req.params.id || req.user.id}-${field}-${timestamp}${fileExtension}`;
    if (
      fileExtension === '.pdf' ||
      fileExtension === '.jpeg' ||
      fileExtension === '.png' ||
      fileExtension === '.jpg'
    ) {
      const filePath = path.join('server/public/employee-documents', filename);
      const promise = fs.promises
        .writeFile(filePath, file.buffer)
        .then(() => {
          req.files[field][0].filename = filename;
          req.files[field][0].path = filePath;
        })
        .catch((err) => {
          console.error('Error while saving document:', err);
        });
      promises.push(promise);
    } else {
      return next(new Error('Unsupported file type'));
    }
  });
  await Promise.all(promises);
  next();
};

const router = express.Router();

//Protect all routes after this middleware
router.use(authController.protect);

router.get(
  '/agreement/getEmployeeAllAgreement/:id',
  authController.restrictTo('Employee', 'Management', 'TeamLead','HR'),
  AgreementController.getEmployeeAllAgreement
);
router.get(
  '/agreement/getEmployeeAllAgreement',
  AgreementController.getEmployeeAllAgreement
);

router.get('/getEmployeeAddress', addressController.getEmployeeAddress);
router.get('/getEmployeeAddress/:id', addressController.getEmployeeAddress);


// UPDATE permanent
router.patch('/updateEmployeePermanentAddress', addressController.updateEmployeePermanentAddress);
router.patch('/updateEmployeePermanentAddress/:id', addressController.updateEmployeePermanentAddress);

// UPDATE current
router.patch('/updateEmployeeCurrentAddress', addressController.updateEmployeeCurrentAddress);
router.patch('/updateEmployeeCurrentAddress/:id', addressController.updateEmployeeCurrentAddress);

// Get employee documents
router.get('/getEmployeeDocuments', adminController.getEmployeeDocuments);
router.get('/getEmployeeDocuments/:id', adminController.getEmployeeDocuments);

// Update/upload employee documents (single or multiple)
router.put(
  '/updateEmployeeDocuments/:id',
  authController.restrictTo('Employee', 'Management', 'TeamLead','HR'),
  authController.uploadDocuments,
  authController.storeDocuments,
  adminController.updateEmployeeDocuments
);

router.get('/getEmployeeBankDetails/:id',
  adminController.getEmployeeBankDetails
)

router.put('/updateEmployeeBankDetails/:id',
  authController.restrictTo('Employee', 'Management', 'TeamLead','HR'),
  adminController.updateEmployeeBankDetails
);

router.get('/getEmployeeSalaryById/:id',
  authController.protect,
  payrollController.getEmployeeSalaryById
);

router.get('/getEmployeeGraduationDetails/:id',
  authController.protect,
  adminController.getEmployeeGraduationDetails
);

router.put('/updateEmployeeGraduationDetails/:id',
  authController.protect,
  adminController.updateEmployeeGraduationDetails
);

// router
//     .route('/getAllAssignedEmployees')
//     .get(
//     authController.restrictTo('Management'),
//     ManagerController.getAllAssignedEmployees
// );

// router.get(
//   '/getSingleEmployeeLeaveRequestManager/:id',
//   authController.restrictTo('Management'),
//   ManagerController.getSingleEmployeeLeaveRequestManager
// );

// router.get(
//   '/getParticularEmployeeLeaveBalance/:id',
//   authController.restrictTo('Management'),
//   ManagerController.getEmployeePaidLeaveById
// );

// router.post(
//   '/performManagerLeaveAction/:id',
//   authController.restrictTo('Management'),
//   ManagerController.performManagerLeaveAction
// );

module.exports = router;