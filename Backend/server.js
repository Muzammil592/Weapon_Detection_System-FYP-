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
const http = require('http');
const socketIo = require('socket.io');

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const notificationsRoutes = require('./routes/notifications');
const detectionsRoutes = require('./routes/detections');

// Middleware
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;
const API_HOST = process.env.API_HOST || '192.168.100.35';

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
app.use('/api/detections', detectionsRoutes);

// Socket.io connection

const axios = require('axios');
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';


// Track active sockets by user (by user name or id)
const userSocketMap = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Listen for start-detection from frontend and forward to AI service
  socket.on('start-detection', async (payload) => {
    try {
      // Map payload to AI service expected format
      const aiPayload = {
        rtsp_url: payload.stream_url,
        location: payload.location,
        user_id: payload.user,
      };
      // Track user-socket association
      if (payload.user) {
        if (!userSocketMap.has(payload.user)) userSocketMap.set(payload.user, new Set());
        userSocketMap.get(payload.user).add(socket.id);
        socket.data.user = payload.user;
      }
      console.log('➡️ Forwarding detection request to AI service:', aiPayload);
      const response = await axios.post(`${AI_SERVICE_URL}/start-detection`, aiPayload, { timeout: 10000 });
      console.log('✅ AI service response:', response.data);
      socket.emit('detection-started', { success: true, message: 'Detection started', aiResponse: response.data });
    } catch (err) {
      console.error('❌ Error forwarding to AI service:', err.message);
      socket.emit('detection-started', { success: false, error: err.message });
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const user = socket.data.user;
    if (user && userSocketMap.has(user)) {
      userSocketMap.get(user).delete(socket.id);
      if (userSocketMap.get(user).size === 0) {
        userSocketMap.delete(user);
        // All sockets for this user are gone, stop detection
        try {
          console.log(`🛑 All sockets for user ${user} disconnected. Stopping detection.`);
          await axios.post(`${AI_SERVICE_URL}/stop-detection`, {}, { timeout: 5000 });
        } catch (err) {
          console.error('❌ Error stopping detection in AI service:', err.message);
        }
      }
    }
  });
});

// Make io available in routes
app.set('io', io);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      console.log(`🚀 Server accessible at http://localhost:${PORT}`);
      console.log(`🚀 Server accessible at http://192.168.100.35:${PORT}`);
      console.log(`🚀 Server accessible at http://0.0.0.0:${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Database connected successfully
    }).on('error', (err) => {
      console.error('❌ Server failed to start:', err.message);
      process.exit(1);
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
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

// Start the server
startServer();