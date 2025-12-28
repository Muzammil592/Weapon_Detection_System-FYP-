/**
 * Dashboard Controller
 * Handles dashboard data operations
 */

const User = require('../models/User');
const Notification = require('../models/Notification');

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
    // Get actual counts from database
    const totalWeapons = await Notification.countDocuments({ type: 'weapon' });
    const alertsSent = await Notification.countDocuments({});
    const accuracy = 0.98; // This could be calculated based on actual detection accuracy

    const stats = {
      totalWeapons,
      alertsSent,
      accuracy,
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
    // Fetch recent notifications and map to activities
    const recentNotifications = await Notification.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const recentActivities = recentNotifications.map(n => ({
      id: n._id.toString(),
      type: n.type === 'weapon' ? 'high' : n.type === 'suspicious' ? 'medium' : 'low',
      message: n.title,
      time: new Date(n.createdAt).toLocaleString(),
    }));

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
