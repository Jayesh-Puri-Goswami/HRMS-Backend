const mongoose = require('mongoose');

const EventSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
    },
    endTime: {
      type: String,
    },
    venue: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    link : {
        type : String,
        default : null
    },
    isActive : {
        type : Boolean,
        default : true
    }
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.model('Event', EventSchema);

module.exports = Event;
