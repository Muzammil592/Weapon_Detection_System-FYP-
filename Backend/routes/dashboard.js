/**
 * Dashboard Routes
 * Handles dashboard data endpoints
 */

const express = require('express');
const router = express.Router();

const {
  getStats,
  getActivity,
  recordDetection,
  getCameraStatus,
  resetStats
} = require('../controllers/dashboardController');

const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// Public routes (with optional auth for user-specific data)
router.get('/stats', optionalAuth, getStats);
router.get('/activity', optionalAuth, getActivity);

// Protected routes
router.get('/camera-status', authenticate, getCameraStatus);
router.post('/detection', authenticate, recordDetection);

// Admin routes
router.post('/reset', authenticate, authorize('admin'), resetStats);

module.exports = router;
