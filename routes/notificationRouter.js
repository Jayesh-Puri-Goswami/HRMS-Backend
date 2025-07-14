const express = require('express');
const authController = require('../controller/AuthController');
const NotificationController = require('../controller/notificationController');

const router = express.Router();

router.use(authController.protect);

router.get(
  '/notification/getAllNotifications',
  NotificationController.getAllNotifications
);

router.put(
  '/notification/mark-read/:id',
  NotificationController.markNotificationAsRead
);

router.put(
  '/notification/mark-all-read',
  NotificationController.markAllNotificationsAsRead
);

router.delete(
  '/notification/clear-notification/:id',
  NotificationController.clearNotification
);

router.delete(
  '/notification/clear-notifications',
  NotificationController.clearNotifications
);

module.exports = router;
