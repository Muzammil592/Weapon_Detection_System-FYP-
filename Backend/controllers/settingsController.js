/**
 * Settings Controller
 * Manage user application preferences and settings
 */

const User = require('../models/User');

// Get current user's settings
exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('settings');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.json({ success: true, data: user.settings || {} });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
};

// Update current user's settings (partial updates supported)
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body?.settings || req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Ensure settings object exists
    if (!user.settings) user.settings = {};

    // Shallow merge top-level settings groups
    const mergeGroup = (group) => {
      if (updates[group] && typeof updates[group] === 'object') {
        user.settings[group] = { ...(user.settings[group] || {}), ...updates[group] };
      }
    };

    mergeGroup('notifications');
    mergeGroup('detection');
    mergeGroup('app');

    // Save changes
    await user.save();
    return res.json({ success: true, data: user.settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
};
