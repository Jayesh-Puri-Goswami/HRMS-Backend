const Notification = require('../model/notification.model');

/**
 * Send a notification to a user.
 * @param {Object} options - Notification details
 * @param {string} options.userId - The recipient user ID
 * @param {string} options.title - The title of the notification
 * @param {string} options.message - The notification message
 * @param {string} [options.type='info'] - Notification type (info, warning, success, error)
 * @param {string} [options.actionUrl=null] - URL for user action (optional)
 */
const sendNotification = async ({
  userId,
  title,
  message,
  type = 'info',
  actionUrl = null,
}) => {
  try {
    if (!userId || !title || !message) {
      console.error('Missing required fields in sendNotification');
      return;
    }

    await Notification.create({
      userId,
      title,
      message,
      type,
      actionUrl,
      isRead: false,
      isDeleted: false,
    });

    console.log(`Notification sent to user ${userId}: ${title}`);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

module.exports = sendNotification;
