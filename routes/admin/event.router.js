const express = require('express');

const router = express.Router();
const authController = require('../../controller/AuthController');
const eventController = require('../../controller/eventController');

router.use(authController.protect);

router.post(
  '/createEvent',
  authController.restrictTo('Admin', 'HR'),
  eventController.createEvent
);

router.get(
  '/getMyEvent',
  authController.restrictTo('Admin', 'HR'),
  eventController.getMyEvents
);

router.put(
  '/updateEvent/:id',
  authController.restrictTo('Admin', 'HR'),
  eventController.updateEvent
);

router.delete(
  '/deleteEvent/:id',
  authController.restrictTo('Admin', 'HR'),
  eventController.deleteEvent
);

module.exports = router;
