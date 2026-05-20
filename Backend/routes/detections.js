const express = require('express');
const router = express.Router();
const Detection = require('../models/Detection');
const Notification = require('../models/Notification');
const Alert = require('../models/Alert');

// Receive detection from AI service
router.post('/receive', async (req, res) => {
  try {
    const {
      weaponType,
      location,
      confidence,
      imageUrl,
      userId,
      cameraName,
      camera_name,
      personName,
      personScore,
      personInfo,
      activityLabel,
      activityScore,
      suspiciousScore,
      activityProbabilities,
      isSuspiciousActivity,
    } = req.body;

    const normalizeScore = (value) => {
      const parsedValue =
        typeof value === 'number'
          ? value
          : (typeof value === 'string' && value.trim() !== ''
              ? Number(value)
              : undefined);

      return Number.isFinite(parsedValue)
        ? Math.max(0, Math.min(1, parsedValue))
        : undefined;
    };

    const normalizedSuspiciousScore = normalizeScore(suspiciousScore);

    const normalizedActivityProbabilities =
      activityProbabilities && typeof activityProbabilities === 'object' && !Array.isArray(activityProbabilities)
        ? activityProbabilities
        : undefined;

    const behaviorDecisionReady =
      isSuspiciousActivity === true ||
      isSuspiciousActivity === false ||
      isSuspiciousActivity === 'true' ||
      isSuspiciousActivity === 'false';
    const suspiciousActivity = isSuspiciousActivity === true || isSuspiciousActivity === 'true';
    const nonSuspiciousActivity = behaviorDecisionReady && !suspiciousActivity;

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
    const recentQuery = {
      weaponType,
      location,
      createdAt: { $gte: tenSecondsAgo }
    };
    if (userId && typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId)) {
      recentQuery.userId = userId;
    }

    const recentDetection = await Detection.findOne(recentQuery);

    if (recentDetection) {
      return res.status(200).json({ success: true, message: 'Duplicate detection ignored' });
    }


    // Only set userId if it's a valid ObjectId (24 hex chars)
    const isValidObjectId = userId && typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId);
    const finalCameraName = cameraName || camera_name;

    const detectionData = {
      weaponType,
      location,
      confidence,
      imageUrl,
      cameraName: finalCameraName,
      personName,
      personScore,
      personInfo,
      activityLabel,
      activityScore,
      suspiciousScore: normalizedSuspiciousScore,
      activityProbabilities: normalizedActivityProbabilities,
      isSuspiciousActivity: behaviorDecisionReady ? suspiciousActivity : undefined,
    };
    if (isValidObjectId) detectionData.userId = userId;
    const detection = new Detection(detectionData);
    await detection.save();

    const faceDetected = Boolean(imageUrl);
    const activityStatusText = behaviorDecisionReady
      ? (suspiciousActivity ? 'suspicious' : 'non-suspicious')
      : null;

    const notificationData = {
      type: 'weapon',
      title: faceDetected
        ? `Weapon (${weaponType}) & Face Detected${activityLabel ? ` [${activityLabel}]` : ''}${activityStatusText ? ` (${activityStatusText})` : ''}`
        : `Weapon Detected: ${weaponType}${activityStatusText ? ` (${activityStatusText})` : ''}`,
      description: faceDetected
        ? `A ${weaponType} was detected at ${location}${finalCameraName ? ` (Camera: ${finalCameraName})` : ''} with ${(confidence * 100).toFixed(1)}% confidence. A face was also captured near the weapon.${personName ? ` Match: ${personName}.` : ''}${activityLabel ? ` Activity: ${activityLabel}${typeof activityScore === 'number' ? ` (${(activityScore * 100).toFixed(1)}%)` : ''}.` : ''}${activityStatusText ? ` Behavior result: ${activityStatusText}.` : ''}`
        : `A ${weaponType} was detected at ${location}${finalCameraName ? ` (Camera: ${finalCameraName})` : ''} with ${(confidence * 100).toFixed(1)}% confidence.${activityLabel ? ` Activity: ${activityLabel}${typeof activityScore === 'number' ? ` (${(activityScore * 100).toFixed(1)}%)` : ''}.` : ''}${activityStatusText ? ` Behavior result: ${activityStatusText}.` : ''}`,
      location,
      icon: faceDetected ? 'person-circle' : 'alert-triangle',
      imageUrl,
      personName,
      personScore,
      personInfo,
      activityLabel,
      activityScore,
      suspiciousScore: normalizedSuspiciousScore,
      activityProbabilities: normalizedActivityProbabilities,
      isSuspiciousActivity: behaviorDecisionReady ? suspiciousActivity : undefined,
    };
    if (isValidObjectId) notificationData.userId = userId;
    const notification = new Notification(notificationData);
    await notification.save();

    // Authority alert is created when behavior marks the detection suspicious.
    let alert = null;
    const shouldCreateAuthorityAlert = suspiciousActivity === true;
    if (shouldCreateAuthorityAlert) {
      alert = new Alert({
        type: 'high',
        title: `Weapon Detected: ${weaponType} (Suspicious Context)`,
        message: `Detected at ${location}${finalCameraName ? ` (Camera: ${finalCameraName})` : ''}${personName ? ` | Match: ${personName}` : ''}${activityLabel ? ` | Activity: ${activityLabel}` : ''}`,
        location,
        imageUrl,
        personName,
        personScore,
        personInfo,
        activityLabel,
        activityScore,
        suspiciousScore: normalizedSuspiciousScore,
        activityProbabilities: normalizedActivityProbabilities,
        isSuspiciousActivity: behaviorDecisionReady ? suspiciousActivity : undefined,
        detectionId: detection._id,
        userId: isValidObjectId ? userId : undefined,
        cameraName: finalCameraName,
        status: 'new'
      });
      await alert.save();
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('weapon-detected', {
      weaponType,
      location,
      confidence,
      cameraName: finalCameraName,
      imageUrl,
      faceDetected,
      personName,
      personScore,
      personInfo,
      activityLabel,
      activityScore,
      suspiciousScore: normalizedSuspiciousScore,
      activityProbabilities: normalizedActivityProbabilities,
      isSuspiciousActivity: behaviorDecisionReady ? suspiciousActivity : null,
      activityStatus: behaviorDecisionReady ? (suspiciousActivity ? 'suspicious' : 'non_suspicious') : 'unknown',
      timestamp: detection.createdAt
    });

    if (nonSuspiciousActivity) {
      io.emit('activity-non-suspicious', {
        weaponType,
        location,
        cameraName: finalCameraName,
        activityLabel,
        activityScore,
        suspiciousScore: normalizedSuspiciousScore,
        activityProbabilities: normalizedActivityProbabilities,
        message: 'Activity is non suspicious',
        timestamp: detection.createdAt
      });
    }

    io.emit('notification-created', {
      type: 'weapon',
      title: notification.title,
      description: notification.description,
      location: notification.location,
      imageUrl: notification.imageUrl,
      personName: notification.personName,
      personScore: notification.personScore,
      personInfo: notification.personInfo,
      activityLabel: notification.activityLabel,
      activityScore: notification.activityScore,
      suspiciousScore: notification.suspiciousScore,
      activityProbabilities: notification.activityProbabilities,
      isSuspiciousActivity: notification.isSuspiciousActivity,
      timestamp: notification.createdAt
    });

    // Emit new alert event for authority dashboards only when suspicious.
    if (alert) {
      io.emit('alert-created', {
        id: alert._id,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        location: alert.location,
        cameraName: alert.cameraName,
        personName: alert.personName,
        personScore: alert.personScore,
        personInfo: alert.personInfo,
        activityLabel: alert.activityLabel,
        activityScore: alert.activityScore,
        suspiciousScore: alert.suspiciousScore,
        activityProbabilities: alert.activityProbabilities,
        isSuspiciousActivity: alert.isSuspiciousActivity,
        createdAt: alert.createdAt
      });
    }

    res.json({
      success: true,
      detection: detection._id,
      notification: notification._id,
      alert: alert ? alert._id : null,
      authorityAlertSent: Boolean(alert),
      behaviorDecisionReady,
      activityStatus: behaviorDecisionReady ? (suspiciousActivity ? 'suspicious' : 'non_suspicious') : 'unknown',
    });
  } catch (error) {
    console.error('Error processing detection:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Receive behavior-only detection from AI parallel pipeline (no weapon trigger required).
// Non-suspicious results are silently ignored — nothing is stored or emitted.
router.post('/receive-behavior', async (req, res) => {
  try {
    const {
      location,
      userId,
      imageUrl,
      activityLabel,
      activityScore,
      isSuspiciousActivity,
      suspiciousScore,
      activityProbabilities,
    } = req.body;

    if (!location) {
      return res.status(400).json({ success: false, error: 'Missing required field: location' });
    }

    const suspiciousActivity = isSuspiciousActivity === true || isSuspiciousActivity === 'true';

    // Non-suspicious: ignore completely — no DB writes, no notifications, no alerts
    if (!suspiciousActivity) {
      return res.status(200).json({ success: true, message: 'Non-suspicious activity ignored' });
    }

    const normalizeScore = (value) => {
      const parsedValue =
        typeof value === 'number'
          ? value
          : (typeof value === 'string' && value.trim() !== ''
              ? Number(value)
              : undefined);
      return Number.isFinite(parsedValue)
        ? Math.max(0, Math.min(1, parsedValue))
        : undefined;
    };

    const normalizedSuspiciousScore = normalizeScore(suspiciousScore);
    const normalizedActivityScore = normalizeScore(activityScore);
    const normalizedActivityProbabilities =
      activityProbabilities && typeof activityProbabilities === 'object' && !Array.isArray(activityProbabilities)
        ? activityProbabilities
        : undefined;

    const isValidObjectId = userId && typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId);

    // Save detection record
    const detectionData = {
      weaponType: 'behavior_only',
      location,
      confidence: 1.0,
      imageUrl,
      activityLabel,
      activityScore: normalizedActivityScore,
      suspiciousScore: normalizedSuspiciousScore,
      activityProbabilities: normalizedActivityProbabilities,
      isSuspiciousActivity: true,
    };
    if (isValidObjectId) detectionData.userId = userId;
    const detection = new Detection(detectionData);
    await detection.save();

    // Save notification for user
    const notificationData = {
      type: 'suspicious',
      title: `Suspicious Activity Detected${activityLabel ? ` [${activityLabel}]` : ''}`,
      description: `Suspicious behavior detected at ${location}${activityLabel ? `. Activity: ${activityLabel}` : ''}${typeof normalizedSuspiciousScore === 'number' ? ` (confidence: ${(normalizedSuspiciousScore * 100).toFixed(1)}%)` : ''}.`,
      location,
      icon: 'alert-triangle',
      imageUrl,
      activityLabel,
      activityScore: normalizedActivityScore,
      suspiciousScore: normalizedSuspiciousScore,
      activityProbabilities: normalizedActivityProbabilities,
      isSuspiciousActivity: true,
    };
    if (isValidObjectId) notificationData.userId = userId;
    const notification = new Notification(notificationData);
    await notification.save();

    // Create authority alert
    const alert = new Alert({
      type: 'high',
      title: `Suspicious Activity Detected${activityLabel ? ` [${activityLabel}]` : ''}`,
      message: `Suspicious behavior detected at ${location}${activityLabel ? ` | Activity: ${activityLabel}` : ''}`,
      location,
      imageUrl,
      activityLabel,
      activityScore: normalizedActivityScore,
      suspiciousScore: normalizedSuspiciousScore,
      activityProbabilities: normalizedActivityProbabilities,
      isSuspiciousActivity: true,
      detectionId: detection._id,
      userId: isValidObjectId ? userId : undefined,
      status: 'new',
    });
    await alert.save();

    const io = req.app.get('io');
    io.emit('behavior-suspicious', {
      location,
      imageUrl,
      activityLabel,
      activityScore: normalizedActivityScore,
      suspiciousScore: normalizedSuspiciousScore,
      activityProbabilities: normalizedActivityProbabilities,
      isSuspiciousActivity: true,
      timestamp: detection.createdAt,
    });

    io.emit('notification-created', {
      type: 'suspicious',
      title: notification.title,
      description: notification.description,
      location: notification.location,
      imageUrl: notification.imageUrl,
      activityLabel: notification.activityLabel,
      activityScore: notification.activityScore,
      suspiciousScore: notification.suspiciousScore,
      activityProbabilities: notification.activityProbabilities,
      isSuspiciousActivity: true,
      timestamp: notification.createdAt,
    });

    io.emit('alert-created', {
      id: alert._id,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      location: alert.location,
      imageUrl: alert.imageUrl,
      activityLabel: alert.activityLabel,
      activityScore: alert.activityScore,
      suspiciousScore: alert.suspiciousScore,
      activityProbabilities: alert.activityProbabilities,
      isSuspiciousActivity: true,
      createdAt: alert.createdAt,
    });

    res.json({
      success: true,
      detection: detection._id,
      notification: notification._id,
      alert: alert._id,
      authorityAlertSent: true,
    });
  } catch (error) {
    console.error('Error processing behavior-only detection:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;