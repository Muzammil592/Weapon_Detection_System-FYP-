const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const authoritySchema = new mongoose.Schema({
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
  officerId: { 
    type: String, 
    required: [true, 'Officer ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  stationName: { 
    type: String, 
    required: [true, 'Station name is required'],
    trim: true
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    default: 'authority',
    enum: ['authority', 'senior_authority', 'admin']
  },
  department: {
    type: String,
    default: 'Police'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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

// Indexes
authoritySchema.index({ email: 1 });
authoritySchema.index({ officerId: 1 });
authoritySchema.index({ stationName: 1 });

// Pre-save middleware
authoritySchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
authoritySchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method for login
authoritySchema.statics.findByCredentials = async function(email, password) {
  const authority = await this.findOne({ email, isActive: true }).select('+password');
  if (!authority) {
    throw new Error('Invalid email or password');
  }
  
  const isMatch = await authority.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }
  
  authority.lastLogin = new Date();
  await authority.save({ validateBeforeSave: false });
  
  return authority;
};

module.exports = mongoose.model('Authority', authoritySchema);
