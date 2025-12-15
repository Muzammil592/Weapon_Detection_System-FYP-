import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { Ionicons } from '@expo/vector-icons';
import { UserStorage, Camera, API_CONFIG } from '../utilities';

// RTSP URL - update this with your camera credentials
const RTSP_URL = 'rtsp://admin:Pakistan1122@192.168.1.64:554/Streaming/Channels/101';

export default function LiveFeed() {
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const vlcRef = useRef<any>(null);

  useEffect(() => {
    const loadCamera = async () => {
      try {
        const userData = await UserStorage.getUser();
        if (userData?.camera?.stream_url) {
          setCamera({
            camera_name: userData.camera.camera_name || 'CCTV Camera',
            stream_url: userData.camera.stream_url,
            location: userData.camera.location || 'Unknown Location',
          });
        } else {
          // Default RTSP stream
          setCamera({
            camera_name: 'CCTV Camera',
            stream_url: RTSP_URL,
            location: 'Main Entrance',
          });
        }
      } catch (error) {
        console.error('Error loading camera:', error);
        setCamera({
          camera_name: 'CCTV Camera',
          stream_url: RTSP_URL,
          location: 'Main Entrance',
        });
      } finally {
        setLoading(false);
      }
    };
    loadCamera();
  }, [attempts]);

  const manualReload = useCallback(() => {
    setStreamError(null);
    setIsPlaying(false);
    setIsBuffering(true);
    setAttempts(a => a + 1);
  }, []);

  const onVLCPlaying = () => {
    setIsPlaying(true);
    setIsBuffering(false);
    setStreamError(null);
  };

  const onVLCBuffering = () => {
    setIsBuffering(true);
  };

  const onVLCStopped = () => {
    setIsPlaying(false);
    setIsBuffering(false);
  };

  const onVLCError = (e: any) => {
    console.error('VLC Error:', e);
    setStreamError('Failed to connect to camera stream');
    setIsPlaying(false);
    setIsBuffering(false);
  };

  const onVLCEnded = () => {
    setIsPlaying(false);
    setIsBuffering(false);
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

      {isBuffering && !streamError && (
        <View style={styles.statusBanner}>
          <ActivityIndicator size="small" color="#3EA0FF" />
          <Text style={styles.statusText}>Connecting to camera stream...</Text>
        </View>
      )}

      <View style={styles.videoContainer}>
        <VLCPlayer
          key={`stream-${attempts}`}
          ref={vlcRef}
          style={styles.video}
          source={{
            uri: camera.stream_url,
            initOptions: [
              // Network & Buffer Settings
              '--network-caching=300',        // Buffer 300ms for stability
              '--rtsp-tcp',                   // Use TCP for reliable delivery
              '--rtsp-frame-buffer-size=500000', // Large frame buffer
              '--rtsp-caching=100',           // RTSP-specific cache
              '--live-caching=100',           // Live stream cache
              
              // Performance Optimization
              '--clock-jitter=0',             // No clock jitter
              '--clock-synchro=0',            // Disable clock sync for lower latency
              '--drop-late-frames',           // Drop frames if late
              '--skip-frames',                // Allow frame skipping
              
              // Codec Settings
              '--avcodec-fast',               // Fast decoding
              '--avcodec-threads=4',          // Multi-threaded decoding
              '--avcodec-skiploopfilter=4',   // Skip loop filter for speed
              
              // Disable Unused Features
              '--no-audio',                   // No audio needed for CCTV
              '--no-spu',                     // No subtitles
              '--no-osd',                     // No on-screen display
              '--no-stats',                   // No statistics
              '--no-snapshot-preview',        // No snapshot preview
              
              // Connection Settings
              '--http-reconnect',             // Auto reconnect
              '--rtsp-user=admin',            // RTSP auth user
              '--rtsp-pwd=Pakistan1122',      // RTSP auth password
            ],
          }}
          autoplay={true}
          onPlaying={onVLCPlaying}
          onBuffering={onVLCBuffering}
          onStopped={onVLCStopped}
          onError={onVLCError}
          onEnded={onVLCEnded}
          resizeMode="contain"
          repeat={true}
        />
        {isBuffering && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3EA0FF" />
            <Text style={styles.connectingText}>Buffering...</Text>
          </View>
        )}
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stream Type:</Text>
          <Text style={styles.infoValue}>RTSP via VLC (Direct)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Protocol:</Text>
          <Text style={styles.infoValue}>TCP (Reliable)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Buffer:</Text>
          <Text style={styles.infoValue}>300ms (Low Latency)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, { color: isPlaying ? '#4ED47A' : streamError ? '#FF4C4C' : '#FF9F43' }]}>
            {isPlaying ? 'Playing' : streamError ? 'Error' : 'Connecting...'}
          </Text>
        </View>
      </View>

      <Text style={styles.helperText}>
        Optimized RTSP stream • Requires Development Build
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
