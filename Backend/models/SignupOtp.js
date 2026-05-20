const mongoose = require('mongoose');

const signupOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'authority'],
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    otpExpiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    payloadEncrypted: {
      type: String,
      required: true,
    },
    // TTL cleanup for stale pending signups
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

signupOtpSchema.index({ email: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('SignupOtp', signupOtpSchema);
