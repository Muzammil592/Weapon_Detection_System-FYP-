const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['suspicious', 'vehicle', 'loitering', 'package', 'camera', 'weapon', 'system'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    default: 'alert-circle',
  },
  location: {
    type: String,
  },
  imageUrl: {
    type: String,
  },
  personName: {
    type: String,
  },
  personScore: {
    type: Number,
  },
  personInfo: {
    type: mongoose.Schema.Types.Mixed,
  },
  activityLabel: {
    type: String,
  },
  activityScore: {
    type: Number,
    min: 0,
    max: 1,
  },
  suspiciousScore: {
    type: Number,
    min: 0,
    max: 1,
  },
  activityProbabilities: {
    type: mongoose.Schema.Types.Mixed,
  },
  isSuspiciousActivity: {
    type: Boolean,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
