const express = require('express');
const Stats = require('../models/Stats');
const Alert = require('../models/Alert');
const Detection = require('../models/Detection');

const router = express.Router();

// GET /api/dashboard/stats - Get overview statistics
router.get('/stats', async (req, res) => {
  try {
    // Get or create stats document
    let stats = await Stats.findOne();
    if (!stats) {
      // Create default stats if none exist
      stats = await Stats.create({
        totalWeapons: 12,
        alertsSent: 5,
        accuracy: 0.98,
      });
    }
    
    res.json({
      totalWeapons: stats.totalWeapons,
      alertsSent: stats.alertsSent,
      accuracy: stats.accuracy,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/activity - Get recent activity
router.get('/activity', async (req, res) => {
  try {
    const alerts = await Alert.find()
      .sort({ createdAt: -1 })
      .limit(10);
    
    if (alerts.length === 0) {
      // Return default fake data if no alerts exist
      return res.json([
        {
          id: '1',
          type: 'high',
          message: 'Weapon detected in Sector 7',
          time: '5m ago',
        },
        {
          id: '2',
          type: 'medium',
          message: 'Suspicious activity in Sector 2',
          time: '15m ago',
        },
        {
          id: '3',
          type: 'low',
          message: 'No unusual activity detected',
          time: '20m ago',
        },
      ]);
    }
    
    // Format alerts for response
    const formattedAlerts = alerts.map(alert => ({
      id: alert._id.toString(),
      type: alert.type,
      message: alert.message,
      time: getTimeAgo(alert.createdAt),
    }));
    
    res.json(formattedAlerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/dashboard/seed - Seed fake data for testing
router.post('/seed', async (req, res) => {
  try {
    // Clear existing data
    await Stats.deleteMany({});
    await Alert.deleteMany({});
    await Detection.deleteMany({});
    
    // Create stats
    const stats = await Stats.create({
      totalWeapons: 12,
      alertsSent: 5,
      accuracy: 0.98,
    });
    
    // Create fake detections
    const detections = await Detection.insertMany([
      {
        weaponType: 'Handgun',
        location: 'Sector 7',
        confidence: 0.95,
      },
      {
        weaponType: 'Knife',
        location: 'Sector 2',
        confidence: 0.87,
      },
      {
        weaponType: 'Rifle',
        location: 'Main Entrance',
        confidence: 0.92,
      },
    ]);
    
    // Create fake alerts
    const now = new Date();
    const alerts = await Alert.insertMany([
      {
        type: 'high',
        message: 'Weapon detected in Sector 7',
        location: 'Sector 7',
        createdAt: new Date(now - 5 * 60 * 1000), // 5 minutes ago
      },
      {
        type: 'medium',
        message: 'Suspicious activity in Sector 2',
        location: 'Sector 2',
        createdAt: new Date(now - 15 * 60 * 1000), // 15 minutes ago
      },
      {
        type: 'low',
        message: 'No unusual activity detected',
        location: 'Main Entrance',
        createdAt: new Date(now - 20 * 60 * 1000), // 20 minutes ago
      },
    ]);
    
    res.json({
      message: 'Test data seeded successfully',
      stats,
      detections: detections.length,
      alerts: alerts.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to format time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

module.exports = router;
