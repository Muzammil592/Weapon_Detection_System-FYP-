/**
 * Cameras Controller
 * Manage additional cameras per user
 */

const User = require('../models/User');
const { generateRtspUrlFromCamera } = require('./authController');

/**
 * @desc    Get all cameras for current user (including primary as first entry)
 * @route   GET /api/cameras
 * @access  Private
 */
const getCameras = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const primaryCamera = {
      id: 'primary',
      name: user.cctvName,
      rtspUrl: user.rtspUrl,
      location: user.location,
      brand: undefined,
    };

    const extraCameras = (user.cameras || []).map((cam, index) => ({
      id: cam._id?.toString() || `extra-${index}`,
      name: cam.name,
      rtspUrl: cam.rtspUrl,
      location: cam.location,
      brand: cam.brand,
    }));

    res.json({
      success: true,
      data: [primaryCamera, ...extraCameras],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a new camera for current user
 * @route   POST /api/cameras
 * @access  Private
 */
const addCamera = async (req, res, next) => {
  try {
    const { name, location, rtspUrl, cameraIp, cameraUsername, cameraPassword, cameraPort, cameraBrand, cameraPath } = req.body;

    if (!name || !location) {
      return res.status(400).json({ success: false, error: 'Camera name and location are required' });
    }

    let finalRtspUrl = rtspUrl;

    if (!finalRtspUrl) {
      finalRtspUrl = generateRtspUrlFromCamera({
        ip: cameraIp,
        username: cameraUsername,
        password: cameraPassword,
        port: cameraPort,
        brand: cameraBrand,
        path: cameraPath,
      });
    }

    if (!finalRtspUrl) {
      return res.status(400).json({ success: false, error: 'Unable to generate RTSP URL from provided camera details' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.cameras = user.cameras || [];
    user.cameras.push({
      name,
      rtspUrl: finalRtspUrl,
      location,
      brand: cameraBrand,
    });

    await user.save();

    res.status(201).json({ success: true, message: 'Camera added successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCameras,
  addCamera,
};
