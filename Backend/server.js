/**
 * Weapon Detection System - Backend Server
 * Main entry point for the API server
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const notificationsRoutes = require('./routes/notifications');

// Middleware
const { notFound, errorHandler } = require('./middleware/errorHandler');

// RTSP Converter (optional - only if file exists)
let RTSPtoHLSConverter;
let streamConverter;
try {
  RTSPtoHLSConverter = require('./rtsp-converter');
  streamConverter = new RTSPtoHLSConverter();
} catch (e) {
  console.log('RTSP converter not available');
}

const app = express();
const PORT = process.env.PORT || 5000;
const API_HOST = process.env.API_HOST || '192.168.100.35';

// RTSP Stream Configuration
const RTSP_URL = process.env.RTSP_URL || 'rtsp://admin:Pakistan1122@192.168.1.64:554/Streaming/Channels/101';

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Auth routes rate limiting (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// CORS Configuration
app.use(cors({
  origin: '*', // In production, specify allowed origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for streams
app.use('/streams', express.static(path.join(__dirname, 'public', 'streams')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Stream control endpoints
app.post('/api/stream/start', (req, res) => {
  if (!streamConverter) {
    return res.status(503).json({ success: false, error: 'Stream converter not available' });
  }
  const rtspUrl = req.body.rtspUrl || RTSP_URL;
  streamConverter.start(rtspUrl);
  res.json({ success: true, message: 'Stream starting...', hlsUrl: '/streams/stream.m3u8' });
});

app.post('/api/stream/stop', (req, res) => {
  if (!streamConverter) {
    return res.status(503).json({ success: false, error: 'Stream converter not available' });
  }
  streamConverter.stop();
  res.json({ success: true, message: 'Stream stopped' });
});

app.get('/api/stream/status', (req, res) => {
  if (!streamConverter) {
    return res.json({ isRunning: false, hlsReady: false, error: 'Stream converter not available' });
  }
  res.json(streamConverter.getStatus());
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Database Connection & Server Start
const startServer = async () => {
  try {
    // MongoDB Connection with retry logic
    const mongoOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://localhost:27017/weapon-detection',
      mongoOptions
    );
    
    console.log('✅ Connected to MongoDB');

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://${API_HOST}:${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Auto-start RTSP to HLS stream
      if (streamConverter) {
        console.log('📹 Starting RTSP stream conversion...');
        streamConverter.start(RTSP_URL);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  // Close server & exit
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  if (streamConverter) {
    streamConverter.stop();
  }
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

// Start the server
startServer();