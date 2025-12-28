const express = require('express');
const router = express.Router();
const Detection = require('../models/Detection');
const Notification = require('../models/Notification');

// Receive detection from AI service
router.post('/receive', async (req, res) => {
  try {
    const { weaponType, location, confidence, imageUrl, userId } = req.body;

    // Validate required fields
    if (!weaponType || !location || confidence === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check confidence threshold
    if (confidence < 0.6) {
      return res.status(200).json({ success: true, message: 'Detection below threshold' });
    }

    // Check for duplicate detection (same weapon type in last 10 seconds)
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const recentDetection = await Detection.findOne({
      weaponType,
      location,
      createdAt: { $gte: tenSecondsAgo }
    });

    if (recentDetection) {
      return res.status(200).json({ success: true, message: 'Duplicate detection ignored' });
    }


    // Only set userId if it's a valid ObjectId (24 hex chars)
    const isValidObjectId = userId && typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId);
    const detectionData = {
      weaponType,
      location,
      confidence,
      imageUrl
    };
    if (isValidObjectId) detectionData.userId = userId;
    const detection = new Detection(detectionData);
    await detection.save();

    const notificationData = {
      type: 'weapon',
      title: `Weapon Detected: ${weaponType}`,
      description: `A ${weaponType} was detected at ${location} with ${(confidence * 100).toFixed(1)}% confidence.`,
      location,
      icon: 'alert-triangle'
    };
    if (isValidObjectId) notificationData.userId = userId;
    const notification = new Notification(notificationData);
    await notification.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('weapon-detected', {
      weaponType,
      location,
      confidence,
      timestamp: detection.createdAt
    });
    io.emit('notification-created', {
      type: 'weapon',
      title: notification.title,
      description: notification.description,
      location: notification.location,
      timestamp: notification.createdAt
    });

    res.json({ success: true, detection: detection._id, notification: notification._id });
  } catch (error) {
    console.error('Error processing detection:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;