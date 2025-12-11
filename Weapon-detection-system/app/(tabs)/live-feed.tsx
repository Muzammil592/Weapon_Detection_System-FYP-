import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'http://10.75.26.41:5000';

interface Camera {
  camera_name: string;
  stream_url: string;
  location: string;
}

export default function LiveFeed() {
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [streamStatus, setStreamStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  // Check if the HLS stream is ready on the server
  const checkStreamStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stream/status`);
      const data = await response.json();
      if (data.isRunning && data.hlsReady) {
        setStreamStatus('ready');
        return true;
      } else if (data.isRunning) {
        // Stream is running but HLS not ready yet
        setStreamStatus('checking');
        return false;
      } else {
        // Try to start the stream
        await fetch(`${API_BASE}/api/stream/start`, { method: 'POST' });
        setStreamStatus('checking');
        return false;
      }
    } catch (error) {
      console.error('Stream status check failed:', error);
      setStreamStatus('error');
      return false;
    }
  }, []);

  useEffect(() => {
    const loadCamera = async () => {
      try {
        const raw = await AsyncStorage.getItem('userData');
        if (raw) {
          const parsed = JSON.parse(raw);
          const userCam = parsed?.camera;
          if (userCam?.stream_url) {
            setCamera({
              camera_name: userCam.camera_name || 'CCTV Camera',
              stream_url: userCam.stream_url,
              location: userCam.location || 'Unknown Location',
            });
          } else {
            // Default HLS stream
            setCamera({
              camera_name: 'CCTV Camera',
              stream_url: `${API_BASE}/streams/stream.m3u8`,
              location: 'Main Entrance',
            });
          }
        } else {
          // Default HLS stream
          setCamera({
            camera_name: 'CCTV Camera',
            stream_url: `${API_BASE}/streams/stream.m3u8`,
            location: 'Main Entrance',
          });
        }
      } catch (error) {
        console.error('Error loading camera:', error);
        setCamera({
          camera_name: 'CCTV Camera',
          stream_url: `${API_BASE}/streams/stream.m3u8`,
          location: 'Main Entrance',
        });
      } finally {
        setLoading(false);
      }
    };
    loadCamera();
  }, [attempts]);

  // Check stream status periodically until ready
  useEffect(() => {
    if (!loading && camera) {
      checkStreamStatus();
      const interval = setInterval(async () => {
        const ready = await checkStreamStatus();
        if (ready) {
          clearInterval(interval);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [loading, camera, checkStreamStatus]);

  const manualReload = useCallback(() => {
    setStreamError(null);
    setIsPlaying(false);
    setStreamStatus('checking');
    setAttempts(a => a + 1);
    checkStreamStatus();
  }, [checkStreamStatus]);

  const buildHtml = (streamUrl: string) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #000; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      min-height: 100vh;
      overflow: hidden;
    }
    #video-container {
      width: 100%;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    video { 
      width: 100%; 
      height: 100%; 
      object-fit: contain;
      background: #000;
    }
    .error {
      color: #ff4444;
      text-align: center;
      padding: 20px;
      font-family: -apple-system, sans-serif;
      font-size: 14px;
    }
    .loading {
      color: #888;
      text-align: center;
      font-family: -apple-system, sans-serif;
      font-size: 14px;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js"></script>
</head>
<body>
  <div id="video-container">
    <video id="video" controls autoplay muted playsinline></video>
  </div>
  <script>
    const video = document.getElementById('video');
    const streamUrl = '${streamUrl}';
    let hls = null;
    let retryCount = 0;
    const maxRetries = 5;
    
    function post(type, payload) {
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
      } catch(e) {}
    }
    
    function initPlayer() {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          liveSyncDurationCount: 1,
          liveMaxLatencyDurationCount: 3,
          liveDurationInfinity: true,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 10000,
          fragLoadingTimeOut: 20000,
        });
        
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          post('status', 'manifest_parsed');
          video.play().then(() => {
            post('playing', true);
            retryCount = 0;
          }).catch(e => {
            post('play_error', e.message);
          });
        });
        
        hls.on(Hls.Events.ERROR, function(event, data) {
          post('hls_error', { type: data.type, details: data.details, fatal: data.fatal });
          
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (retryCount < maxRetries) {
                  retryCount++;
                  post('status', 'retrying_' + retryCount);
                  setTimeout(() => {
                    hls.loadSource(streamUrl);
                  }, 2000);
                } else {
                  post('fatal', 'Network error - stream not available');
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                post('status', 'recovering_media_error');
                hls.recoverMediaError();
                break;
              default:
                post('fatal', 'Fatal playback error');
                break;
            }
          }
        });
        
        hls.on(Hls.Events.FRAG_LOADED, function() {
          post('buffering', false);
        });
        
        hls.on(Hls.Events.FRAG_LOADING, function() {
          post('buffering', true);
        });
        
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari/iOS)
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          post('status', 'native_hls_loaded');
          video.play().catch(e => post('play_error', e.message));
        });
        video.addEventListener('playing', () => post('playing', true));
        video.addEventListener('error', () => post('fatal', 'Video playback error'));
      } else {
        post('fatal', 'HLS not supported');
      }
    }
    
    video.addEventListener('playing', () => post('playing', true));
    video.addEventListener('pause', () => post('playing', false));
    video.addEventListener('waiting', () => post('buffering', true));
    video.addEventListener('canplay', () => post('buffering', false));
    
    // Start player
    initPlayer();
  </script>
</body>
</html>`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3EA0FF" />
          <Text style={styles.loadingText}>Loading camera...</Text>
        </View>
      </View>
    );
  }

  if (!camera) {
    return (
      <View style={styles.container}>
        <View style={styles.noCameraContainer}>
          <Ionicons name="videocam-off" size={80} color="#4A5568" />
          <Text style={styles.noCameraTitle}>No Camera Configured</Text>
          <Text style={styles.noCameraText}>
            Your account doesn't have a camera stream configured.
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={manualReload}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.liveBadge, !isPlaying && styles.liveBadgeOffline]}>
            <View style={[styles.liveDot, !isPlaying && styles.liveDotOffline]} />
            <Text style={styles.liveText}>{isPlaying ? 'LIVE' : 'OFFLINE'}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{camera.camera_name}</Text>
        </View>
        <TouchableOpacity onPress={manualReload} style={styles.reloadBtn}>
          <Ionicons name="refresh" size={22} color="#3EA0FF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.locationRow}>
        <Ionicons name="location" size={14} color="#718096" />
        <Text style={styles.locationText}>{camera.location}</Text>
      </View>

      {streamError && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={24} color="#FF4C4C" />
          <Text style={styles.errorText}>{streamError}</Text>
          <TouchableOpacity onPress={manualReload} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {streamStatus === 'checking' && !streamError && (
        <View style={styles.statusBanner}>
          <ActivityIndicator size="small" color="#3EA0FF" />
          <Text style={styles.statusText}>Connecting to stream server...</Text>
        </View>
      )}

      <View style={styles.videoContainer}>
        {streamStatus === 'ready' ? (
          <WebView
            key={`stream-${attempts}`}
            source={{ html: buildHtml(camera.stream_url) }}
            style={styles.video}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            mixedContentMode="always"
            onMessage={(event) => {
              try {
                const msg = JSON.parse(event.nativeEvent.data);
                console.log('WebView message:', msg);
                
                if (msg.type === 'playing') {
                  setIsPlaying(msg.payload);
                  if (msg.payload) {
                    setStreamError(null);
                  }
                }
                if (msg.type === 'fatal') {
                  setStreamError(msg.payload || 'Stream connection failed');
                  setIsPlaying(false);
                }
                if (msg.type === 'status') {
                  console.log('Stream status:', msg.payload);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }}
            onError={(e) => {
              console.error('WebView error:', e);
              setStreamError('Failed to load video player');
            }}
          />
        ) : (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3EA0FF" />
            <Text style={styles.connectingText}>
              {streamStatus === 'error' ? 'Connection failed' : 'Waiting for stream...'}
            </Text>
            {streamStatus === 'error' && (
              <TouchableOpacity onPress={manualReload} style={styles.smallRetryBtn}>
                <Text style={styles.smallRetryText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stream Type:</Text>
          <Text style={styles.infoValue}>HLS (Expo Go Compatible)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Server:</Text>
          <Text style={styles.infoValue}>{streamStatus === 'ready' ? 'Connected' : 'Connecting...'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Playback:</Text>
          <Text style={[styles.infoValue, { color: isPlaying ? '#4ED47A' : streamError ? '#FF4C4C' : '#FF9F43' }]}>
            {isPlaying ? 'Playing' : streamError ? 'Error' : 'Buffering...'}
          </Text>
        </View>
      </View>

      <Text style={styles.helperText}>
        Stream is converted from RTSP to HLS on the server
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1523',
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#B0B8C3',
    fontSize: 16,
    marginTop: 12,
  },
  noCameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noCameraTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  noCameraText: {
    color: '#B0B8C3',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C3A5F',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 30,
  },
  refreshText: {
    color: '#fff',
    fontSize: 15,
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4C4C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  liveBadgeOffline: {
    backgroundColor: '#4A5568',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 5,
  },
  liveDotOffline: {
    backgroundColor: '#888',
  },
  liveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  reloadBtn: {
    padding: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  locationText: {
    color: '#718096',
    fontSize: 13,
    marginLeft: 6,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C3A5F',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 10,
  },
  statusText: {
    color: '#B0B8C3',
    fontSize: 13,
  },
  videoContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    height: 220,
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    color: '#B0B8C3',
    fontSize: 14,
    marginTop: 12,
  },
  smallRetryBtn: {
    marginTop: 16,
    backgroundColor: '#3EA0FF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  smallRetryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 76, 76, 0.1)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 76, 76, 0.3)',
  },
  errorText: {
    color: '#FF4C4C',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#FF4C4C',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#132436',
    borderRadius: 10,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#718096',
    fontSize: 14,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  helperText: {
    color: '#4A5568',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
});
