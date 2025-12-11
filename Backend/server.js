require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const notificationsRoutes = require('./routes/notifications');
const RTSPtoHLSConverter = require('./rtsp-converter');

const app = express();
const PORT = process.env.PORT || 5000;

// RTSP Stream Configuration
const RTSP_URL = process.env.RTSP_URL || 'rtsp://admin:Pakistan1122@192.168.1.64:554/Streaming/Channels/101';

// Initialize RTSP to HLS converter
const streamConverter = new RTSPtoHLSConverter();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/streams', express.static(path.join(__dirname, 'public', 'streams')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationsRoutes);

// Stream control endpoints
app.post('/api/stream/start', (req, res) => {
  const rtspUrl = req.body.rtspUrl || RTSP_URL;
  streamConverter.start(rtspUrl);
  res.json({ success: true, message: 'Stream starting...', hlsUrl: '/streams/stream.m3u8' });
});

app.post('/api/stream/stop', (req, res) => {
  streamConverter.stop();
  res.json({ success: true, message: 'Stream stopped' });
});

app.get('/api/stream/status', (req, res) => {
  res.json(streamConverter.getStatus());
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/weapon-detection', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Auto-start RTSP to HLS stream
    console.log('Starting RTSP stream conversion...');
    streamConverter.start(RTSP_URL);
  });
}).catch(err => console.error('MongoDB connection error:', err));