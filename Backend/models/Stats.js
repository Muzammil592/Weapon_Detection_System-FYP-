const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
  totalWeapons: {
    type: Number,
    default: 0,
  },
  alertsSent: {
    type: Number,
    default: 0,
  },
  accuracy: {
    type: Number,
    default: 0.98,
    min: 0,
    max: 1,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Stats', statsSchema);
