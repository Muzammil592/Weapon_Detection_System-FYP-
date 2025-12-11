const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Authority = require('../models/Authority');
const { spawn } = require('child_process');
const path = require('path');

const router = express.Router();

// Store reset tokens temporarily (in production, use Redis or database)
const resetTokens = new Map();

// Signup for User
router.post('/signup/user', async (req, res) => {
  try {
    const { name, email, phone, password, cctvName, rtspUrl, location } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, phone, password: hashedPassword, cctvName, rtspUrl, location });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Signup for Authority
router.post('/signup/authority', async (req, res) => {
  try {
    const { name, email, officerId, stationName, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const authority = new Authority({ name, email, officerId, stationName, password: hashedPassword });
    await authority.save();
    res.status(201).json({ message: 'Authority registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });
    let role = 'user';
    let camera = null;
    if (!user) {
      user = await Authority.findOne({ email });
      role = 'authority';
    } else {
      // For users, include camera details with HLS URL (converted from RTSP by backend)
      camera = {
        camera_name: user.cctvName,
        stream_url: `http://10.75.26.41:5000/streams/stream.m3u8`,
        location: user.location,
      };
    }
    if (!user) return res.status(400).json({ error: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    res.json({ 
      success: true,
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        ...(camera && { camera })
      } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stream endpoint for RTSP to HLS conversion
router.get('/stream/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rtspUrl = user.rtspUrl;
    const outputPath = path.join(__dirname, '../public/stream.m3u8');

    // Start FFmpeg process
    const ffmpeg = spawn('ffmpeg', [
      '-i', rtspUrl,
      '-f', 'hls',
      '-hls_time', '1',
      '-hls_list_size', '0',
      outputPath
    ]);

    ffmpeg.stdout.on('data', (data) => {
      console.log(`FFmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
      console.error(`FFmpeg stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
    });

    // Serve the HLS stream
    res.sendFile(outputPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Forgot Password - Send Reset Link
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists in either collection
    let user = await User.findOne({ email });
    let userType = 'user';
    
    if (!user) {
      user = await Authority.findOne({ email });
      userType = 'authority';
    }
    
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour
    
    // Store token (in production, save to database)
    resetTokens.set(resetToken, {
      email,
      userType,
      expiry: resetTokenExpiry
    });
    
    // In production, you would send an actual email here
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(`Reset link: http://10.75.26.41:5000/api/auth/reset-password/${resetToken}`);
    
    res.json({ 
      success: true, 
      message: 'Password reset link has been sent to your email',
      ...(process.env.NODE_ENV !== 'production' && { resetToken })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Password - Verify Token and Update Password
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    
    const tokenData = resetTokens.get(token);
    
    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    if (Date.now() > tokenData.expiry) {
      resetTokens.delete(token);
      return res.status(400).json({ error: 'Reset token has expired' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password based on user type
    if (tokenData.userType === 'user') {
      await User.findOneAndUpdate(
        { email: tokenData.email },
        { password: hashedPassword }
      );
    } else {
      await Authority.findOneAndUpdate(
        { email: tokenData.email },
        { password: hashedPassword }
      );
    }
    
    // Remove used token
    resetTokens.delete(token);
    
    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Google OAuth - Placeholder route
router.get('/google', (req, res) => {
  res.status(501).json({ 
    error: 'Google Sign-In not configured',
    message: 'Please set up Google OAuth credentials in Google Cloud Console'
  });
});

// Google OAuth Callback - Placeholder
router.get('/google/callback', async (req, res) => {
  res.status(501).json({ 
    error: 'Google Sign-In not configured',
    message: 'Please set up Google OAuth credentials in Google Cloud Console'
  });
});

module.exports = router;