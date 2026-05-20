/**
 * Notifications Controller
 * Handles notification operations
 */


const Notification = require('../models/Notification');

const buildUserScope = (req) => {
  if (req?.userRole === 'user' && req.user?._id) {
    return { userId: req.user._id };
  }

  return {};
};

/**
 * @desc    Get all notifications
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    // Fetch all notifications from MongoDB, newest first
    const notifications = await Notification.find(userScope)
      .sort({ createdAt: -1 })
      .lean();
    // Map MongoDB _id to id and createdAt to time for frontend compatibility
    const mapped = notifications.map(n => ({
      ...n,
      id: n._id?.toString(),
      time: n.createdAt ? new Date(n.createdAt).toLocaleString() : '',
    }));
    console.log('Notifications returned:', mapped.length);
    res.json(mapped);
  } catch (error) {
    console.error('Error in getNotifications:', error);
    next(error);
  }
};

/**
 * @desc    Get single notification
 * @route   GET /api/notifications/:id
 * @access  Private
 */
const getNotification = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    const notification = await Notification.findOne({ _id: req.params.id, ...userScope }).lean();
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...notification,
        id: notification._id?.toString(),
        time: notification.createdAt ? new Date(notification.createdAt).toLocaleString() : '',
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create notification (from system/ML model)
 * @route   POST /api/notifications
 * @access  Private
 */
const createNotification = async (req, res, next) => {
  try {
    const { type, title, description, location, userId } = req.body;

    const iconMap = {
      weapon: 'alert-circle',
      suspicious: 'warning',
      vehicle: 'car',
      loitering: 'person',
      package: 'cube',
      camera: 'videocam-off',
      system: 'settings'
    };

    const notification = new Notification({
      type: type || 'system',
      title,
      description,
      icon: iconMap[type] || 'notifications',
      isRead: false,
      location,
      userId,
    });

    await notification.save();

    res.status(201).json({
      success: true,
      data: {
        ...notification.toObject(),
        id: notification._id?.toString(),
        time: notification.createdAt ? new Date(notification.createdAt).toLocaleString() : '',
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    const notification = await Notification.findOne({ _id: req.params.id, ...userScope });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: {
        ...notification.toObject(),
        id: notification._id?.toString(),
        time: notification.createdAt ? new Date(notification.createdAt).toLocaleString() : '',
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    await Notification.updateMany(userScope, { $set: { isRead: true } });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
const deleteNotification = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    const result = await Notification.deleteOne({ _id: req.params.id, ...userScope });
    
    if (!result.deletedCount) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Clear all notifications
 * @route   DELETE /api/notifications/clear
 * @access  Private
 */
const clearAll = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    await Notification.deleteMany(userScope);

    res.json({
      success: true,
      message: 'All notifications cleared'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unread count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userScope = buildUserScope(req);
    const count = await Notification.countDocuments({ ...userScope, isRead: false });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getNotification,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
  getUnreadCount
};
