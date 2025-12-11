const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  location: {
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
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Alert', alertSchema);
