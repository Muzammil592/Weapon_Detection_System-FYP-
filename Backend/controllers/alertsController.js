/**
 * Alerts Controller
 * Handles authority alert operations
 */

const Alert = require('../models/Alert');

const buildUserScope = (req) => {
  if (!req?.user) return {};

  if (req.userRole === 'user') {
    return { userId: req.user._id };
  }

  if (req.userRole === 'authority' || req.userRole === 'senior_authority') {
    return {};
  }

  return {};
};

/**
 * @desc    Get new alerts (unassigned)
 * @route   GET /api/alerts/new
 * @access  Private (authority)
 */
const getNewAlerts = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    const alerts = await Alert.find({ status: 'new', ...userScope })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get my active alerts (accepted by current authority)
 * @route   GET /api/alerts/my-active
 * @access  Private (authority)
 */
const getMyActiveAlerts = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    const alerts = await Alert.find({ status: 'accepted', assignedTo: req.user._id, ...userScope })
      .sort({ acceptedAt: -1 })
      .lean();
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept an alert (assign to current authority)
 * @route   POST /api/alerts/:id/accept
 * @access  Private (authority)
 */
const acceptAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userScope = buildUserScope(req);
    const alert = await Alert.findOne({ _id: id, ...userScope });
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    if (alert.status !== 'new' && String(alert.assignedTo) !== String(req.user._id)) {
      return res.status(400).json({ success: false, error: 'Alert already handled by another authority' });
    }
    alert.status = 'accepted';
    alert.assignedTo = req.user._id;
    alert.acceptedAt = new Date();
    await alert.save();
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Dismiss an alert
 * @route   POST /api/alerts/:id/dismiss
 * @access  Private (authority)
 */
const dismissAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userScope = buildUserScope(req);
    const alert = await Alert.findOne({ _id: id, ...userScope });
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    alert.status = 'dismissed';
    alert.assignedTo = req.user._id;
    await alert.save();
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resolve an alert (optional)
 * @route   POST /api/alerts/:id/resolve
 * @access  Private (authority)
 */
const resolveAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userScope = buildUserScope(req);
    const alert = await Alert.findOne({ _id: id, ...userScope });
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    await alert.save();
    res.json({ success: true, data: alert });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get my handled alerts history (accepted/dismissed/resolved)
 * @route   GET /api/alerts/history
 * @access  Private (authority)
 */
const getMyHistoryAlerts = async (req, res, next) => {
  try {
    const { type, startDate, endDate, q } = req.query;

    const match = {
      status: { $in: ['accepted', 'dismissed', 'resolved'] },
      ...buildUserScope(req),
    };

    if (type) match.type = type;

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    // Simple text search on message/location/title
    const textFilters = [];
    if (q) {
      const regex = new RegExp(q, 'i');
      textFilters.push({ message: regex }, { location: regex }, { title: regex });
    }

    const query = textFilters.length ? { $and: [match, { $or: textFilters }] } : match;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get authority dashboard feed (alerts only)
 * @route   GET /api/alerts/feed
 * @access  Private (authority)
 */
const getDashboardFeed = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    const alerts = await Alert.find({ status: 'new', ...userScope })
      .sort({ createdAt: -1 })
      .lean();
    const alertItems = alerts.map((a) => ({
      ...a,
      source: 'alert'
    }));

    res.json({ success: true, data: alertItems });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNewAlerts,
  getMyActiveAlerts,
  getMyHistoryAlerts,
  getDashboardFeed,
  acceptAlert,
  dismissAlert,
  resolveAlert,
};
