const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    startTime: { type: String, required: true }, // Format: "HH:mm"
    endTime: { type: String, required: true },
    lunchTime: { type: Number, default: 0 }, // In minutes
    breakTime: { type: Number, default: 0 }, // In minutes
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Helper function to convert "HH:mm" string to minutes
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr?.split(':')?.map(Number);
  return hours * 60 + minutes;
};

const minutesToHHMM = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0'
  )}`;
};

shiftSchema.virtual('totalWorkingTime').get(function () {
  const startMinutes = timeToMinutes(this.startTime);
  const endMinutes = timeToMinutes(this.endTime);
  return endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : 1440 - startMinutes + endMinutes;
});

shiftSchema.virtual('totalWorkingTimeHHMM').get(function () {
  return minutesToHHMM(this.totalWorkingTime);
});

shiftSchema.virtual('totalWorkingTimeWithoutBreaks').get(function () {
  return this.totalWorkingTime - (this.lunchTime + this.breakTime);
});

shiftSchema.virtual('totalWorkingTimeWithoutBreaksHHMM').get(function () {
  return minutesToHHMM(this.totalWorkingTimeWithoutBreaks);
});

const formatTimeAMPM = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12; // Convert 0 to 12 for AM
  return `${String(formattedHours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0'
  )} ${ampm}`;
};

shiftSchema.virtual('startTimeFormatted').get(function () {
  return formatTimeAMPM(this.startTime);
});

shiftSchema.virtual('endTimeFormatted').get(function () {
  return formatTimeAMPM(this.endTime);
});

module.exports = mongoose.model('Shift', shiftSchema);
