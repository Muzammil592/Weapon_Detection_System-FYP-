/**
 * Authentication Routes
 * Handles user and authority authentication
 */

const express = require('express');
const router = express.Router();

const {
  registerUser,
  registerAuthority,
  verifySignupOtp,
  resendSignupOtp,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout
} = require('../controllers/authController');

const { authenticate, authorize } = require('../middleware/auth');
const { 
  validateUserSignup, 
  validateAuthoritySignup, 
  validateLogin,
  validateForgotPassword,
  validateSignupOtpVerification,
  validateSignupOtpResend,
} = require('../middleware/validation');

// Public routes
router.post('/signup/user', validateUserSignup, registerUser);
router.post('/signup/authority', validateAuthoritySignup, registerAuthority);
router.post('/verify-signup-otp', validateSignupOtpVerification, verifySignupOtp);
router.post('/resend-signup-otp', validateSignupOtpResend, resendSignupOtp);
router.post('/login', validateLogin, login);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected routes
router.get('/me', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);
router.post('/logout', authenticate, logout);

module.exports = router;
