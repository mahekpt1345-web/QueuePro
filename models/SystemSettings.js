/**
 * SYSTEM SETTINGS MODEL
 * Stores global admin-controlled settings in MongoDB (singleton pattern).
 */

const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  // Singleton key — only one document should ever exist
  _key: {
    type: String,
    default: 'global',
    unique: true
  },

  // Queue settings
  tokenGeneration: {
    type: Boolean,
    default: true
  },
  tokenCancellation: {
    type: Boolean,
    default: true
  },
  autoRefresh: {
    type: Boolean,
    default: true
  },

  // Registration settings
  registrations: {
    type: Boolean,
    default: true
  },
  officerRegistration: {
    type: Boolean,
    default: true
  },

  // Notification settings
  notifications: {
    type: Boolean,
    default: true
  },
  fcmNotifications: {
    type: Boolean,
    default: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    default: null
  }
});

// Always update the updatedAt timestamp on save
systemSettingsSchema.pre('save', function () {
  this.updatedAt = new Date();
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
module.exports = SystemSettings;
