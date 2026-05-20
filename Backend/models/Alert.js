const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  // Priority of the alert
  type: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true,
  },
  // Brief title/message shown in lists
  message: {
    type: String,
    required: true,
  },
  // Optional rich title used in UI
  title: {
    type: String,
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
  cameraName: {
    type: String,
  },
  detectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Detection',
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Workflow status for authority handling
  status: {
    type: String,
    enum: ['new', 'accepted', 'dismissed', 'resolved'],
    default: 'new',
    index: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Authority',
  },
  acceptedAt: Date,
  resolvedAt: Date,
  isRead: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
