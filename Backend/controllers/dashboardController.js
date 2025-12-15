/**
 * Dashboard Controller
 * Handles dashboard data operations
 */

const User = require('../models/User');

// Simulated detection data (in production, this would come from ML model)
let detectionStats = {
  totalWeapons: 0,
  alertsSent: 0,
  accuracy: 0.98
};

let activities = [];

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard/stats
 * @access  Private
 */
const getStats = async (req, res, next) => {
  try {
    // In production, fetch from database based on user
    const stats = {
      totalWeapons: detectionStats.totalWeapons,
      alertsSent: detectionStats.alertsSent,
      accuracy: detectionStats.accuracy,
      lastUpdated: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get recent activities
 * @route   GET /api/dashboard/activity
 * @access  Private
 */
const getActivity = async (req, res, next) => {
  try {
    // Return stored activities or default ones
    const recentActivities = activities.length > 0 ? activities : [
      {
        id: '1',
        type: 'low',
        message: 'System monitoring active',
        time: 'Just now'
      }
    ];

    res.json(recentActivities);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record a detection event
 * @route   POST /api/dashboard/detection
 * @access  Private (from ML model)
 */
const recordDetection = async (req, res, next) => {
  try {
    const { type, message, location, confidence } = req.body;

    // Update stats
    if (type === 'weapon') {
      detectionStats.totalWeapons += 1;
      detectionStats.alertsSent += 1;
    }

    // Add to activities
    const activity = {
      id: Date.now().toString(),
      type: type === 'weapon' ? 'high' : type === 'suspicious' ? 'medium' : 'low',
      message: message || `${type} detected`,
      time: new Date().toLocaleTimeString(),
      location,
      confidence
    };

    activities.unshift(activity);
    
    // Keep only last 50 activities
    if (activities.length > 50) {
      activities = activities.slice(0, 50);
    }

    res.status(201).json({
      success: true,
      message: 'Detection recorded',
      data: activity
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's camera status
 * @route   GET /api/dashboard/camera-status
 * @access  Private
 */
const getCameraStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        camera_name: user.cctvName,
        location: user.location,
        rtsp_url: user.rtspUrl,
        status: 'active' // In production, check actual stream status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset dashboard stats (for testing)
 * @route   POST /api/dashboard/reset
 * @access  Private (admin only)
 */
const resetStats = async (req, res, next) => {
  try {
    detectionStats = {
      totalWeapons: 0,
      alertsSent: 0,
      accuracy: 0.98
    };
    activities = [];

    res.json({
      success: true,
      message: 'Dashboard stats reset'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStats,
  getActivity,
  recordDetection,
  getCameraStatus,
  resetStats
};
