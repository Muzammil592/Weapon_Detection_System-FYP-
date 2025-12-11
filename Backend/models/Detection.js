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
