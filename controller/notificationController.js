const Notification = require('../model/notification.model');
const catchAsync = require('../utills/catchAsync');
const APIFeatures = require('../utills/apiFeatures');

exports.getAllNotifications = catchAsync(async (req, res, next) => {
  let filter = { userId: req.user.id };

  const features = new APIFeatures(Notification.find(filter), req.query)
    .filter()
    .sort('-isRead')
    .limitFields()
    .paginate();

  const notifications = await features.query;

  res.status(200).json({
    status: 'success',
    results: notifications.length,
    data: {
      notifications,
    },
  });
});

exports.markNotificationAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return res
      .status(404)
      .json({ status: 'fail', message: 'Notification not found' });
  }

  res.status(200).json({
    status: 'success',
    data: {
      notification,
    },
  });
});

exports.markAllNotificationsAsRead = catchAsync(async (req, res, next) => {
  const result = await Notification.updateMany(
    { userId: req.user.id, isRead: false },
    { $set: { isRead: true } }
  );

  res.status(200).json({
    status: 'success',
    message: 'All notifications marked as read',
    data: {
      modifiedCount: result.modifiedCount,
    },
  });
});

exports.clearNotifications = catchAsync(async (req, res, next) => {
  await Notification.deleteMany({ userId: req.user.id });
  res.status(200).json({ message: 'All notifications cleared successfully' });
});

exports.clearNotification = catchAsync(async (req, res, next) => {
  await Notification.deleteOne({ _id: req.params.id });

  res.status(200).json({ message: 'Notification removed successfully' });
});
