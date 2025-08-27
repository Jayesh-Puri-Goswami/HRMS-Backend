const catchAsync = require('../utills/catchAsync');
const AppError = require('../utills/appError');
const Event = require('../model/event.model');
const User = require('../model/admin.model');
const Notification = require('../model/notification.model');
const sendNotification = require('../utills/notificationHelper');

// Create Event
exports.createEvent = catchAsync(async (req, res, next) => {
  const {
    title,
    description,
    startTime,
    endTime,
    eventDate,
    venue,
    participants,
    link,
    isActive,
    // actionUrl
  } = req.body;
  const creator = req.user;

  // Validation: Start < End
  if (new Date(startTime) >= new Date(endTime)) {
    return next(new AppError('Start time must be before end time.', 400));
  }

  // Hierarchy check
  const creatorRole = creator.role; // assuming you store it like this
  const allowedRoles = {
    Admin: ['Admin', 'HR', 'Management', 'TeamLead', 'Employee'],
    HR: ['Admin', 'HR', 'Management', 'TeamLead', 'Employee'],
    Management: ['Management', 'TeamLead', 'Employee'],
    TeamLead: ['TeamLead', 'Management', 'Employee'],
  };

  //   [ '67f73c572dbc8a6864bfd1ec', '67f7bd3478ba767320b79d33' ]

  const validParticipants = await User.find({ _id: { $in: participants } });

  for (const user of validParticipants) {
    if (!allowedRoles[creatorRole]?.includes(user.role)) {
      return next(
        new AppError(
          `You can't create meeting for ${user.name} (${user.role})`,
          403
        )
      );
    }
  }
  // Save Meeting
  const event = await Event.create({
    title,
    description,
    startTime,
    endTime,
    eventDate,
    venue,
    createdBy: creator._id,
    participants,
    link,
    isActive: isActive ? isActive : true,
  });

  // Send Notifications
  for (const userId of participants) {
    await Notification.create({
      userId,
      title: 'New Meeting Scheduled',
      message: `${creator.name} has scheduled a meeting: ${title}`,
      type: 'info',
    });

    await sendNotification({
      userId,
      title: 'New Meeting',
      message: `You are invited to a meeting: ${title} at ${venue}`,
      type: 'info',
    });
  }

  res.status(201).json({
    status: 'success',
    data: event,
  });
});

// Get Event By user

exports.getMyEvents = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const events = await Event.find({
    $or: [{ createdBy: userId }, { participants: userId }],
  })
    .populate('createdBy', 'name role email')
    .populate('participants', 'name role email')
    .sort({ eventDate: -1 });

  res.status(200).json({
    status: 'success',
    results: events.length,
    data: events,
  });
});

exports.getMyUpcomingEvents = catchAsync(async (req, res, next) => {
	const userId = req.user._id;
	const now = new Date();
	
	const events = await Event.find({
		$and: [
			{ $or: [{ createdBy: userId }, { participants: userId }] },
			{ eventDate: { $gte: now } },
		],
	})
		.populate('createdBy', 'name role email')
		.populate('participants', 'name role email')
		.sort({ eventDate: 1 });

	res.status(200).json({
		status: 'success',
		results: events.length,
		data: events,
	});
});

//   Update the event

exports.updateEvent = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  console.log(id);

  const {
    title,
    description,
    startTime,
    endTime,
    eventDate,
    venue,
    participants,
    link,
    isActive,
  } = req.body;

  const event = await Event.findById(id);
  if (!event) {
    return next(new AppError('Event not found', 404));
  }

  // Only creator can edit
  if (event.createdBy.toString() !== req.user._id.toString()) {
    return next(new AppError('You are not authorized to edit this event', 403));
  }

  const creatorRole = req.user.role;
  const allowedRoles = {
    Admin: ['Admin', 'HR', 'Management', 'TeamLead', 'Employee'],
    HR: ['HR', 'Management', 'TeamLead', 'Employee'],
    Management: ['Management', 'TeamLead', 'Employee'],
    TeamLead: ['TeamLead', 'Management', 'Employee'],
  };

  const validParticipants = await User.find({ _id: { $in: participants } });
  for (const user of validParticipants) {
    if (!allowedRoles[creatorRole]?.includes(user.role)) {
      return next(
        new AppError(
          `You can't assign this user (${user.name}) to meeting`,
          403
        )
      );
    }
  }

  // Update fields
  event.title = title;
  event.description = description;
  event.startTime = startTime;
  event.endTime = endTime;
  event.eventDate = eventDate;
  event.venue = venue;
  event.participants = participants;
  event.link = link;
  event.isActive = isActive;

  await event.save();

  res.status(200).json({
    status: 'success',
    data: event,
  });
});

//  Delete event

exports.deleteEvent = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const event = await Event.findById(id);
  if (!event) {
    return next(new AppError('Event not found', 404));
  }

  if (event.createdBy.toString() !== req.user._id.toString()) {
    return next(
      new AppError('You are not authorized to delete this event', 403)
    );
  }

  await Event.findByIdAndDelete(id);

  res.status(200).json({
    status: 'success',
    message: 'Event deleted successfully',
  });
});
