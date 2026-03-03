const mongoose = require('mongoose');

// Token Schema - Queue token information
const tokenSchema = new mongoose.Schema({
  // Token identification
  tokenId: {
    type: String,
    unique: true,
    required: true,
    // Format: TOKEN_1707478234567
  },

  // Who requested it
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  username: {
    type: String,
    required: true
  },

  // User's actual name
  userName: {
    type: String,
    required: true
  },

  // Service type
  serviceType: {
    type: String,
    enum: [
      'aadhaar_update',
      'caste_certificate_verification',
      'income_certificate_verification',
      'birth_certificate_verification',
      'municipal_enquiry',
      'other'
    ]
  },

  // Description (optional)
  description: {
    type: String,
    default: ''
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'serving', 'completed', 'cancelled'],
    default: 'pending'
  },

  // Queue position
  position: {
    type: Number,
    default: null
  },

  // Estimated wait time (in minutes)
  estimatedWaitTime: {
    type: Number,
    default: null
  },

  // Actual wait time (in minutes) - calculated when completed
  actualWaitTime: {
    type: Number,
    default: null
  },

  // Officer handling it
  handledBy: {
    type: String,
    default: null  // Officer username
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },

  startedAt: {
    type: Date,
    default: null  // When officer starts serving
  },

  completedAt: {
    type: Date,
    default: null  // When token is completed
  },

  cancelledAt: {
    type: Date,
    default: null
  },

  cancelReason: {
    type: String,
    default: null
  },

  // Checklist confirmation
  checklistConfirmed: {
    type: Boolean,
    default: false
  }
});

// Middleware to calculate wait time when serving starts
tokenSchema.pre('save', function () {
  // Wait time calculation: Time from creation to being called (startedAt)
  if (this.startedAt && this.createdAt && this.actualWaitTime === null) {
    const waitMs = this.startedAt - this.createdAt;
    this.actualWaitTime = Math.max(0, Math.round(waitMs / (1000 * 60)));
  }
});

const Token = mongoose.model('Token', tokenSchema);
module.exports = Token;