const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema - Blueprint for user data
const userSchema = new mongoose.Schema({
  // Basic Information
  username: {
    type: String,
    required: true,
    unique: true,  // No two users with same username
    trim: true,
    minlength: 3
  },

  email: {
    type: String,
    required: true,
    unique: true,
    match: /^\S+@\S+\.\S+$/  // Email format validation
  },

  password: {
    type: String,
    required: true,
    minlength: 6
  },

  name: {
    type: String,
    required: true
  },

  // Role (citizen, officer, admin)
  role: {
    type: String,
    enum: ['citizen', 'officer', 'admin'],
    required: true,
    default: 'citizen'
  },

  // Phone (Mobile Number) - Optional for OAuth users (can be added later)
  phone: {
    type: String,
    unique: true,
    sparse: true,  // Allow null values while maintaining uniqueness
    trim: true
  },

  // Additional fields
  createdAt: {
    type: Date,
    default: Date.now
  },

  lastLogin: {
    type: Date,
    default: null
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // For officers
  assignedService: {
    type: String,
    default: null  // e.g., "Passport Counter A"
  },

  // User preferences for notifications
  preferences: {
    type: {
      emailNotif: { type: Boolean, default: true },
      queueNotif: { type: Boolean, default: true },
      announceNotif: { type: Boolean, default: true },
      promoNotif: { type: Boolean, default: false }
    },
    default: {}
  },

  // OAuth fields removed

  phoneVerified: {
    type: Boolean,
    default: false  // Set to true when phone is verified by user
  },

  // Engagement History
  engagementHistory: {
    puzzles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Puzzle' }],
    reading: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EngagementContent' }]
  },
  
  fcmToken: {
    type: String,
    default: null
  }
});

// Generate placeholder phone if missing (for legacy users or admin-created officers)
userSchema.pre('validate', async function () {
  if (!this.phone) {
    this.phone = this.role + '-' + (this.username || Date.now().toString());
  }
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password (for login)
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to remove password from response
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;  // Don't send password to frontend
  return user;
};

// Performance Indexes
userSchema.index({ role: 1 });

// Create and export model
const User = mongoose.model('User', userSchema);
module.exports = User;