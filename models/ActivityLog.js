const mongoose = require('mongoose');

// Activity Log Schema - Track all user actions
const activityLogSchema = new mongoose.Schema({
  // Who did it
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  username: {
    type: String,
    required: true
  },
  
  userRole: {
    type: String,
    enum: ['citizen', 'officer', 'admin'],
    required: true
  },
  
  // What action
  action: {
    type: String,
    required: true
    // Examples: 'LOGIN', 'CREATE_TOKEN', 'COMPLETE_TOKEN', 'UPDATE_PROFILE'
  },
  
  // Details of action
  details: {
    type: String,
    default: ''
  },
  
  // Related resource
  resourceType: {
    type: String,
    default: null
    // Examples: 'USER', 'TOKEN', 'QUEUE'
  },
  
  resourceId: {
    type: String,
    default: null
  },
  
  // Status
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  },
  
  // Error message if failed
  errorMessage: {
    type: String,
    default: null
  },
  
  // IP address (optional)
  ipAddress: {
    type: String,
    default: null
  },
  
  // Device info (optional)
  userAgent: {
    type: String,
    default: null
  },
  
  // Timestamp
  createdAt: {
    type: Date,
    default: Date.now,
    index: true  // Make it searchable by date
  }
});

// Index for searching by username and date
activityLogSchema.index({ username: 1, createdAt: -1 });
// Index for searching by action
activityLogSchema.index({ action: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
module.exports = ActivityLog;