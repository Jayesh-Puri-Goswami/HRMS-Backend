const express = require('express');
const authController = require('../../controller/AuthController');
const queryController = require('../../userController/queryController');

const router = express.Router();

router.use(authController.protect);

// Create Query
router.post(
  '/createQuery',
  authController.restrictTo('Employee', 'Management','TeamLead'),
  queryController.createQuery
);

// Get All Queries
router.get(
  '/getAllQueries',
  authController.restrictTo('Employee', 'Management','TeamLead'),
  queryController.getAllQueries
);


module.exports = router;