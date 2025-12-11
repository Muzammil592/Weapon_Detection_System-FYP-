const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Try to use ffmpeg-static, fall back to system ffmpeg
let ffmpegPath = 'ffmpeg';
try {
  const ffmpegStatic = require('ffmpeg-static');
  if (ffmpegStatic) {
    ffmpegPath = ffmpegStatic;
    console.log('Using ffmpeg-static:', ffmpegPath);
  }
} catch (e) {
  console.log('ffmpeg-static not found, using system ffmpeg');
}

class RTSPtoHLSConverter {
  constructor() {
    this.ffmpegProcess = null;
    this.isRunning = false;
    this.outputDir = path.join(__dirname, 'public', 'streams');
    this.rtspUrl = null;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 10;
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // Clean old segments on startup
    this.cleanOldSegments();
  }

  cleanOldSegments() {
    try {
      const files = fs.readdirSync(this.outputDir);
      files.forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.m3u8')) {
          fs.unlinkSync(path.join(this.outputDir, file));
        }
      });
      console.log('Cleaned old HLS segments');
    } catch (e) {
      // Ignore errors
    }
  }

  start(rtspUrl) {
    if (this.isRunning && this.ffmpegProcess) {
      console.log('Stream already running');
      return true;
    }

    this.rtspUrl = rtspUrl;
    this.cleanOldSegments();
    
    const outputPath = path.join(this.outputDir, 'stream.m3u8');
    
    // FFmpeg command optimized for low-latency RTSP to HLS
    const ffmpegArgs = [
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-vsync', '0',
      '-copyts',
      '-vcodec', 'copy',
      '-movflags', 'frag_keyframe+empty_moov',
      '-an',
      '-hls_flags', 'delete_segments+append_list',
      '-f', 'hls',
      '-hls_time', '1',
      '-hls_list_size', '3',
      '-hls_segment_filename', path.join(this.outputDir, 'segment_%03d.ts'),
      outputPath
    ];

    console.log('========================================');
    console.log('Starting RTSP to HLS conversion...');
    console.log('FFmpeg path:', ffmpegPath);
    console.log('RTSP URL:', rtspUrl.replace(/:[^:@]+@/, ':****@'));
    console.log('Output:', outputPath);
    console.log('========================================');

    try {
      this.ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
      this.isRunning = true;

      this.ffmpegProcess.stdout.on('data', (data) => {
        console.log(`[FFmpeg stdout]: ${data.toString().trim()}`);
      });

      this.ffmpegProcess.stderr.on('data', (data) => {
        const message = data.toString();
        // Log important messages
        if (message.includes('frame=') || 
            message.includes('Opening') || 
            message.includes('Stream') ||
            message.includes('error') ||
            message.includes('Error')) {
          console.log(`[FFmpeg]: ${message.trim()}`);
        }
      });

      this.ffmpegProcess.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
        this.isRunning = false;
        this.ffmpegProcess = null;
        
        // Auto-restart on unexpected exit (but limit attempts)
        if (code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          console.log(`Restarting stream in 3 seconds... (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);
          setTimeout(() => this.start(this.rtspUrl), 3000);
        } else if (this.restartAttempts >= this.maxRestartAttempts) {
          console.log('Max restart attempts reached. Please check RTSP connection.');
        }
      });

      this.ffmpegProcess.on('error', (err) => {
        console.error('FFmpeg spawn error:', err.message);
        this.isRunning = false;
        this.ffmpegProcess = null;
      });

      // Reset restart counter on successful start after 10 seconds
      setTimeout(() => {
        if (this.isRunning) {
          this.restartAttempts = 0;
        }
      }, 10000);

      return true;
    } catch (error) {
      console.error('Failed to start FFmpeg:', error.message);
      this.isRunning = false;
      return false;
    }
  }

  stop() {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGINT');
      this.ffmpegProcess = null;
      this.isRunning = false;
      console.log('Stream stopped');
    }
  }

  getStatus() {
    // Check if HLS file exists
    const hlsFile = path.join(this.outputDir, 'stream.m3u8');
    const hlsExists = fs.existsSync(hlsFile);
    
    return {
      isRunning: this.isRunning,
      hlsReady: hlsExists,
      outputDir: this.outputDir,
      hlsUrl: '/streams/stream.m3u8',
      restartAttempts: this.restartAttempts
    };
  }
}

module.exports = RTSPtoHLSConverter;
