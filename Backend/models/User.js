const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: { 
    type: String, 
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[\d\s\-+()]{10,}$/, 'Please enter a valid phone number']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  cctvName: { 
    type: String, 
    required: [true, 'CCTV name is required'],
    trim: true
  },
  rtspUrl: { 
    type: String, 
    required: [true, 'RTSP URL is required'],
    trim: true
  },
  location: { 
    type: String, 
    required: [true, 'Location is required'],
    trim: true
  },
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'admin']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  passwordResetToken: String,
  passwordResetExpires: Date
}, { 
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get user's camera info
userSchema.methods.getCameraInfo = function() {
  return {
    camera_name: this.cctvName,
    rtsp_url: this.rtspUrl,
    location: this.location
  };
};

// Static method to find user by email with password
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email, isActive: true }).select('+password');
  if (!user) {
    throw new Error('Invalid email or password');
  }
  
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }
  
  // Update last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });
  
  return user;
};

module.exports = mongoose.model('User', userSchema);
