/**
 * Authentication Routes
 * Handles user and authority authentication
 */

const express = require('express');
const router = express.Router();

const {
  registerUser,
  registerAuthority,
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
  validateForgotPassword 
} = require('../middleware/validation');

// Public routes
router.post('/signup/user', validateUserSignup, registerUser);
router.post('/signup/authority', validateAuthoritySignup, registerAuthority);
router.post('/login', validateLogin, login);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected routes
router.get('/me', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);
router.post('/logout', authenticate, logout);

module.exports = router;
