const mongoose = require('mongoose');

const holidaysSchema = new mongoose.Schema(
  {
    holidayTitle: { type: String, required: true },
    // Adding new fields for all holidays
    shift: { 
        type: String,
        required: true 
    },
    createdBy : {
        // type: mongoose.Schema.Types.ObjectId,
        type: String,
        // ref: 'User',
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    
    // 
    fromDate: Date,
    toDate: Date,
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Holidays', holidaysSchema);
