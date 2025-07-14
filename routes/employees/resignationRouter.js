const express = require('express');
const authController = require('../../controller/AuthController');
const ResignationController = require("../../controller/resignationController");

const router = express.Router();


router.post(
  '/createResignation',
  authController.protect,
  ResignationController.createOrUpdateResignation
);


module.exports = router;