const express = require('express');
const Notification = require('../models/Notification');

const router = express.Router();

// GET /api/notifications - Get all notifications
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(50);
    
    if (notifications.length === 0) {
      // Return default fake data if no notifications exist
      return res.json([
        {
          id: '1',
          type: 'suspicious',
          title: 'Suspicious Activity Detected',
          time: '10:30 AM',
          description: 'Unrecognized individual at main gate.',
          icon: 'warning',
          isRead: false,
        },
        {
          id: '2',
          type: 'vehicle',
          title: 'Unusual Vehicle Movement',
          time: '10:15 AM',
          description: 'Vehicle circling parking lot.',
          icon: 'car',
          isRead: false,
        },
        {
          id: '3',
          type: 'loitering',
          title: 'Person Loitering Near Entrance',
          time: '9:45 AM',
          description: 'Individual standing near entrance for extended period.',
          icon: 'person',
          isRead: true,
        },
        {
          id: '4',
          type: 'package',
          title: 'Package Left Unattended',
          time: '9:30 AM',
          description: 'Unattended package detected in Sector 2.',
          icon: 'cube',
          isRead: false,
        },
        {
          id: '5',
          type: 'camera',
          title: 'Camera Offline – Sector 3',
          time: '9:00 AM',
          description: 'Camera in Sector 3 has gone offline.',
          icon: 'videocam-off',
          isRead: true,
        },
        {
          id: '6',
          type: 'weapon',
          title: 'Weapon Detected',
          time: '8:45 AM',
          description: 'Potential weapon detected at main entrance.',
          icon: 'alert-circle',
          isRead: false,
        },
      ]);
    }
    
    // Format notifications for response
    const formattedNotifications = notifications.map(notification => ({
      id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      time: formatTime(notification.createdAt),
      description: notification.description,
      icon: notification.icon,
      isRead: notification.isRead,
      location: notification.location,
    }));
    
    res.json(formattedNotifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/:userId - Get notifications for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    const formattedNotifications = notifications.map(notification => ({
      id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      time: formatTime(notification.createdAt),
      description: notification.description,
      icon: notification.icon,
      isRead: notification.isRead,
      location: notification.location,
    }));
    
    res.json(formattedNotifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/:id - Get a single notification
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({
      id: notification._id.toString(),
      type: notification.type,
      title: notification.title,
      time: formatTime(notification.createdAt),
      description: notification.description,
      icon: notification.icon,
      isRead: notification.isRead,
      location: notification.location,
      createdAt: notification.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({}, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndDelete(id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/seed - Seed fake notifications for testing
router.post('/seed', async (req, res) => {
  try {
    // Clear existing notifications
    await Notification.deleteMany({});
    
    const now = new Date();
    
    // Create fake notifications
    const notifications = await Notification.insertMany([
      {
        type: 'suspicious',
        title: 'Suspicious Activity Detected',
        description: 'Unrecognized individual at main gate.',
        icon: 'warning',
        location: 'Main Gate',
        createdAt: new Date(now - 30 * 60 * 1000), // 30 minutes ago
      },
      {
        type: 'vehicle',
        title: 'Unusual Vehicle Movement',
        description: 'Vehicle circling parking lot.',
        icon: 'car',
        location: 'Parking Lot',
        createdAt: new Date(now - 45 * 60 * 1000), // 45 minutes ago
      },
      {
        type: 'loitering',
        title: 'Person Loitering Near Entrance',
        description: 'Individual standing near entrance for extended period.',
        icon: 'person',
        location: 'Main Entrance',
        isRead: true,
        createdAt: new Date(now - 75 * 60 * 1000), // 1h 15m ago
      },
      {
        type: 'package',
        title: 'Package Left Unattended',
        description: 'Unattended package detected in Sector 2.',
        icon: 'cube',
        location: 'Sector 2',
        createdAt: new Date(now - 90 * 60 * 1000), // 1h 30m ago
      },
      {
        type: 'camera',
        title: 'Camera Offline – Sector 3',
        description: 'Camera in Sector 3 has gone offline.',
        icon: 'videocam-off',
        location: 'Sector 3',
        isRead: true,
        createdAt: new Date(now - 120 * 60 * 1000), // 2h ago
      },
      {
        type: 'weapon',
        title: 'Weapon Detected',
        description: 'Potential weapon detected at main entrance.',
        icon: 'alert-circle',
        location: 'Main Entrance',
        createdAt: new Date(now - 135 * 60 * 1000), // 2h 15m ago
      },
    ]);
    
    res.json({
      message: 'Notifications seeded successfully',
      count: notifications.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to format time
function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  // Format as time if today, otherwise as date
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

module.exports = router;
