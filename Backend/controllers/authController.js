/**
 * Authentication Controller
 * Handles all authentication-related operations
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Authority = require('../models/Authority');
const SignupOtp = require('../models/SignupOtp');
const { sendEmail } = require('../services/emailService');

// API Configuration
const API_HOST = process.env.API_HOST || '192.168.100.35';
const API_PORT = process.env.API_PORT || '5000';
const API_BASE = `http://${API_HOST}:${API_PORT}`;

const SIGNUP_OTP_TTL_MINUTES = Number(process.env.SIGNUP_OTP_TTL_MINUTES || 10);
const SIGNUP_OTP_MAX_ATTEMPTS = Number(process.env.SIGNUP_OTP_MAX_ATTEMPTS || 5);

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const normalizeRole = (role) => (role === 'authority' ? 'authority' : 'user');

const generateSignupOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const hashOtp = (otp) => {
  const salt = process.env.JWT_SECRET || 'signup-otp-salt';
  return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
};

const getPayloadKey = () => {
  return crypto.createHash('sha256').update(process.env.JWT_SECRET || 'signup-payload-key').digest();
};

const encryptPayload = (payload) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getPayloadKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted.toString('hex')}`;
};

const decryptPayload = (payloadEncrypted) => {
  const [ivHex, tagHex, encryptedHex] = String(payloadEncrypted || '').split('.');
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Invalid encrypted signup payload');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', getPayloadKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
};

const sendSignupOtpEmail = async ({ email, name, otp, role }) => {
  const subject = 'Your Weapon Detection verification OTP';
  const accountType = role === 'authority' ? 'authority' : 'user';
  const greetingName = name || 'User';
  const text = `Hello ${greetingName},\n\nYour OTP for ${accountType} account verification is: ${otp}\nThis OTP expires in ${SIGNUP_OTP_TTL_MINUTES} minutes.\n\nIf you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Account Verification OTP</h2>
      <p>Hello ${greetingName},</p>
      <p>Your OTP for <strong>${accountType}</strong> account verification is:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 16px 0;">${otp}</p>
      <p>This OTP will expire in <strong>${SIGNUP_OTP_TTL_MINUTES} minutes</strong>.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
  });
};

// Store reset tokens (use Redis in production)
const resetTokens = new Map();

/**
 * Helper: Generate RTSP URL from camera details
 * Keeps DB schema the same while making signup user-friendly.
 */
const generateRtspUrlFromCamera = ({
  ip,
  username,
  password,
  port = 554,
  brand,
  path
}) => {
  if (!ip || !username || !password) return null;

  const normalizedBrand = (brand || '').toLowerCase();
  let streamPath = path;

  if (!streamPath) {
    if (normalizedBrand.includes('hikvision')) {
      streamPath = '/Streaming/Channels/101';
    } else if (normalizedBrand.includes('dahua')) {
      // Dahua-style format as per working example
      streamPath = '/cam/realmonitor?channel=1&subtype=1';
    } else {
      // Generic/default stream path (aligned with Dahua-style URL)
      streamPath = '/cam/realmonitor?channel=1&subtype=1';
    }
  }

  const finalPort = port || 554;

  return `rtsp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${ip}:${finalPort}${streamPath}`;
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/signup/user
 * @access  Public
 */
const registerUser = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      cctvName,
      rtspUrl,
      location,
      // New camera-friendly fields (used only to generate RTSP)
      cameraIp,
      cameraUsername,
      cameraPassword,
      cameraPort,
      cameraBrand,
      cameraPath,
    } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Determine final RTSP URL.
    // Priority: explicit rtspUrl (for backward compatibility),
    // otherwise generate from camera fields.
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
      return res.status(400).json({
        success: false,
        error: 'Unable to generate RTSP URL from provided camera details',
      });
    }

    const normalizedEmail = email.toLowerCase();
    const otp = generateSignupOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + SIGNUP_OTP_TTL_MINUTES * 60 * 1000);

    const payloadEncrypted = encryptPayload({
      name,
      email: normalizedEmail,
      phone,
      password,
      cctvName,
      rtspUrl: finalRtspUrl,
      location,
    });

    await SignupOtp.findOneAndUpdate(
      { email: normalizedEmail, role: 'user' },
      {
        email: normalizedEmail,
        role: 'user',
        otpHash,
        otpExpiresAt,
        attempts: 0,
        payloadEncrypted,
        expiresAt: otpExpiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendSignupOtpEmail({
      email: normalizedEmail,
      name,
      otp,
      role: 'user',
    });

    const response = {
      success: true,
      message: 'Verification OTP sent to your email. Please verify to complete registration.',
      data: {
        email: normalizedEmail,
        role: 'user',
        requiresOtp: true,
      },
    };

    if (process.env.NODE_ENV !== 'production' && process.env.RETURN_OTP_IN_RESPONSE === 'true') {
      response.data.otp = otp;
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register a new authority
 * @route   POST /api/auth/signup/authority
 * @access  Public
 */
const registerAuthority = async (req, res, next) => {
  try {
    const { name, email, officerId, stationName, password } = req.body;

    // Check if authority exists
    const existingAuthority = await Authority.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { officerId: officerId.toUpperCase() }
      ]
    });
    
    if (existingAuthority) {
      return res.status(400).json({
        success: false,
        error: 'Authority with this email or officer ID already exists'
      });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedOfficerId = officerId.toUpperCase();
    const otp = generateSignupOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + SIGNUP_OTP_TTL_MINUTES * 60 * 1000);

    const payloadEncrypted = encryptPayload({
      name,
      email: normalizedEmail,
      officerId: normalizedOfficerId,
      stationName,
      password,
    });

    await SignupOtp.findOneAndUpdate(
      { email: normalizedEmail, role: 'authority' },
      {
        email: normalizedEmail,
        role: 'authority',
        otpHash,
        otpExpiresAt,
        attempts: 0,
        payloadEncrypted,
        expiresAt: otpExpiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendSignupOtpEmail({
      email: normalizedEmail,
      name,
      otp,
      role: 'authority',
    });

    const response = {
      success: true,
      message: 'Verification OTP sent to your email. Please verify to complete registration.',
      data: {
        email: normalizedEmail,
        role: 'authority',
        requiresOtp: true,
      },
    };

    if (process.env.NODE_ENV !== 'production' && process.env.RETURN_OTP_IN_RESPONSE === 'true') {
      response.data.otp = otp;
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify signup OTP and finalize account creation
 * @route   POST /api/auth/verify-signup-otp
 * @access  Public
 */
const verifySignupOtp = async (req, res, next) => {
  try {
    const { email, otp, role } = req.body;
    const normalizedEmail = email.toLowerCase();
    const normalizedRole = normalizeRole(role);

    const pending = await SignupOtp.findOne({
      email: normalizedEmail,
      role: normalizedRole,
    });

    if (!pending) {
      return res.status(400).json({
        success: false,
        error: 'No pending signup found for this email. Please register again.',
      });
    }

    if (new Date() > pending.otpExpiresAt) {
      await SignupOtp.deleteOne({ _id: pending._id });
      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please request a new OTP.',
      });
    }

    const incomingOtpHash = hashOtp(String(otp));
    if (incomingOtpHash !== pending.otpHash) {
      pending.attempts += 1;
      if (pending.attempts >= SIGNUP_OTP_MAX_ATTEMPTS) {
        await SignupOtp.deleteOne({ _id: pending._id });
        return res.status(400).json({
          success: false,
          error: 'Maximum OTP attempts exceeded. Please register again.',
        });
      }

      await pending.save({ validateBeforeSave: false });
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP. Please try again.',
      });
    }

    const payload = decryptPayload(pending.payloadEncrypted);

    if (normalizedRole === 'authority') {
      const authorityExists = await Authority.findOne({
        $or: [
          { email: payload.email.toLowerCase() },
          { officerId: String(payload.officerId).toUpperCase() },
        ],
      });

      if (authorityExists) {
        await SignupOtp.deleteOne({ _id: pending._id });
        return res.status(400).json({
          success: false,
          error: 'Authority with this email or officer ID already exists',
        });
      }

      const authority = await Authority.create({
        name: payload.name,
        email: payload.email.toLowerCase(),
        officerId: String(payload.officerId).toUpperCase(),
        stationName: payload.stationName,
        password: payload.password,
        isVerified: true,
      });

      await SignupOtp.deleteOne({ _id: pending._id });

      return res.status(201).json({
        success: true,
        message: 'Authority registered and verified successfully',
        data: {
          id: authority._id,
          name: authority.name,
          email: authority.email,
          officerId: authority.officerId,
        },
      });
    }

    const userExists = await User.findOne({ email: payload.email.toLowerCase() });
    if (userExists) {
      await SignupOtp.deleteOne({ _id: pending._id });
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    const user = await User.create({
      name: payload.name,
      email: payload.email.toLowerCase(),
      phone: payload.phone,
      password: payload.password,
      cctvName: payload.cctvName,
      rtspUrl: payload.rtspUrl,
      location: payload.location,
      isVerified: true,
    });

    await SignupOtp.deleteOne({ _id: pending._id });

    return res.status(201).json({
      success: true,
      message: 'User registered and verified successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend signup OTP for pending registration
 * @route   POST /api/auth/resend-signup-otp
 * @access  Public
 */
const resendSignupOtp = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const normalizedEmail = email.toLowerCase();
    const normalizedRole = normalizeRole(role);

    const pending = await SignupOtp.findOne({
      email: normalizedEmail,
      role: normalizedRole,
    });

    if (!pending) {
      return res.status(400).json({
        success: false,
        error: 'No pending signup found for this email. Please register again.',
      });
    }

    const otp = generateSignupOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + SIGNUP_OTP_TTL_MINUTES * 60 * 1000);

    pending.otpHash = otpHash;
    pending.otpExpiresAt = otpExpiresAt;
    pending.expiresAt = otpExpiresAt;
    pending.attempts = 0;
    await pending.save({ validateBeforeSave: false });

    let name = 'User';
    try {
      const payload = decryptPayload(pending.payloadEncrypted);
      name = payload.name || 'User';
    } catch (_) {
      // Keep fallback name if payload decryption fails unexpectedly
    }

    await sendSignupOtpEmail({
      email: normalizedEmail,
      name,
      otp,
      role: normalizedRole,
    });

    const response = {
      success: true,
      message: 'A new OTP has been sent to your email.',
      data: {
        email: normalizedEmail,
        role: normalizedRole,
      },
    };

    if (process.env.NODE_ENV !== 'production' && process.env.RETURN_OTP_IN_RESPONSE === 'true') {
      response.data.otp = otp;
    }

    return res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user or authority
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const emailLower = email.toLowerCase();

    // Try to find user first
    let user = await User.findOne({ email: emailLower }).select('+password');
    let role = 'user';
    let camera = null;

    if (!user) {
      // Try to find authority
      user = await Authority.findOne({ email: emailLower }).select('+password');
      role = user?.role || 'authority';
    } else {
      // Build camera info for user
      camera = {
        camera_name: user.cctvName,
        stream_url: `${API_BASE}/streams/stream.m3u8`,
        location: user.location,
        rtsp_url: user.rtspUrl
      };
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact support.'
      });
    }

    if (user.isVerified === false) {
      return res.status(403).json({
        success: false,
        error: 'Account is not verified. Please verify your email OTP first.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(user._id, role);

    // Build response
    const userData = {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role,
      isVerified: user.isVerified !== false,
      ...(camera && { camera }),
      ...(role === 'user' && {
        phone: user.phone,
        cctvName: user.cctvName,
        location: user.location
      }),
      ...(role !== 'user' && {
        officerId: user.officerId,
        stationName: user.stationName,
        department: user.department
      })
    };

    res.json({
      success: true,
      token,
      user: userData,
      role
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getProfile = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const allowedUpdates = ['name', 'phone', 'cctvName', 'rtspUrl', 'location'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password') ||
                 await Authority.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password - request reset
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const emailLower = email.toLowerCase();

    // Find user or authority
    let user = await User.findOne({ email: emailLower });
    let userType = 'user';
    
    if (!user) {
      user = await Authority.findOne({ email: emailLower });
      userType = 'authority';
    }

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes

    // Store token
    resetTokens.set(resetToken, {
      email: emailLower,
      userType,
      expiry: resetTokenExpiry
    });

    // Log reset link (in production, send email)
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: ${API_BASE}/api/auth/reset-password/${resetToken}`);

    res.json({
      success: true,
      message: 'Password reset link has been sent to your email',
      ...(process.env.NODE_ENV !== 'production' && { resetToken })
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password with token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Validate token
    const tokenData = resetTokens.get(token);
    if (!tokenData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Check expiry
    if (Date.now() > tokenData.expiry) {
      resetTokens.delete(token);
      return res.status(400).json({
        success: false,
        error: 'Reset token has expired'
      });
    }

    // Find and update user
    let user;
    if (tokenData.userType === 'authority') {
      user = await Authority.findOne({ email: tokenData.email });
    } else {
      user = await User.findOne({ email: tokenData.email });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update password
    user.password = password;
    await user.save();

    // Delete used token
    resetTokens.delete(token);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user (client-side token deletion)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res, next) => {
  try {
    // Stop AIService detection for this user session
    const axios = require('axios');
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    try {
      await axios.post(`${AI_SERVICE_URL}/stop-detection`, {}, { timeout: 5000 });
    } catch (err) {
      // Log but don't block logout if AIService is unreachable
      console.error('Failed to notify AIService to stop detection:', err.message);
    }
    res.json({
      success: true,
      message: 'Logged out successfully and AIService stopped.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  registerAuthority,
  verifySignupOtp,
  resendSignupOtp,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
  // Exported for reuse in other controllers (e.g., camerasController)
  generateRtspUrlFromCamera,
};
