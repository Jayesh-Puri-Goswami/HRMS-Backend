const express = require('express');

const router = express.Router();
const authController = require('../../controller/AuthController');
const eventController = require('../../controller/eventController');

router.use(authController.protect);

router.post(
  '/Event/create',
  authController.restrictTo('Management', 'TeamLead'),
  eventController.createEvent
);

router.get(
  '/Event/getAll',
  authController.restrictTo('Management', 'TeamLead','Employee'),
  eventController.getMyEvents
);

router.put(
  '/Event/update/:id',
  authController.restrictTo('Management', 'TeamLead'),
  eventController.updateEvent
);

router.delete(
  '/Event/create/:id',
  authController.restrictTo('Management', 'TeamLead'),
  eventController.deleteEvent
);

module.exports = router;
