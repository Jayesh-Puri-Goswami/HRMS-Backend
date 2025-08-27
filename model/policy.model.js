const mongoose = require('mongoose');

const PolicySchema = new mongoose.Schema(
  {
    policyType: {
      type: String,
      enum: [
        'Leave Policy',
        'Attendance Policy',
        'Code of Conduct',
        'Disciplinary Policy',
        'Increment And Appraisal Policy',
      ],
      required: true,
    },
    policyVersion: {
      type: String,
      required: true,
    },
    file: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Policy', PolicySchema);
