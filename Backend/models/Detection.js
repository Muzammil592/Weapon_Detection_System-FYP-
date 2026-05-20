const mongoose = require('mongoose');

const detectionSchema = new mongoose.Schema({
  weaponType: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Detection', detectionSchema);
