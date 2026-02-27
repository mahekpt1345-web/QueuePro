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
  
  // Phone (optional)
  phone: {
    type: String,
    default: null
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
  }
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password (for login)
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to remove password from response
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;  // Don't send password to frontend
  return user;
};

// Create and export model
const User = mongoose.model('User', userSchema);
module.exports = User;