/**
 * Live Feed Screen with VLC Player
 * Direct RTSP streaming without conversion
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserStorage, Camera, API_CONFIG } from '../utils';

// RTSP URL - update this with your camera credentials
const RTSP_URL = 'rtsp://admin:Pakistan1122@192.168.1.64:554/Streaming/Channels/101';

export default function LiveFeedScreen() {
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
        } else if (userData?.rtspUrl) {
          // Use rtspUrl from user data if available
          setCamera({
            camera_name: userData.cctvName || 'CCTV Camera',
            stream_url: userData.rtspUrl,
            location: userData.location || 'Unknown Location',
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
          <Icon name="videocam-off" size={80} color="#4A5568" />
          <Text style={styles.noCameraTitle}>No Camera Configured</Text>
          <Text style={styles.noCameraText}>
            Your account doesn't have a camera stream configured.
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={manualReload}>
            <Icon name="refresh" size={20} color="#fff" />
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
          <Icon name="refresh" size={22} color="#3EA0FF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.locationRow}>
        <Icon name="location" size={14} color="#718096" />
        <Text style={styles.locationText}>{camera.location}</Text>
      </View>

      {streamError && (
        <View style={styles.errorContainer}>
          <Icon name="warning" size={24} color="#FF4C4C" />
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
          onEnd={onVLCEnded}
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
        Direct RTSP stream via VLC • Low latency streaming
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
    paddingHorizontal: 32,
  },
  noCameraTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
  },
  noCameraText: {
    color: '#718096',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3EA0FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  refreshText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 212, 122, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  liveBadgeOffline: {
    backgroundColor: 'rgba(255, 76, 76, 0.2)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ED47A',
    marginRight: 6,
  },
  liveDotOffline: {
    backgroundColor: '#FF4C4C',
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
  errorContainer: {
    backgroundColor: 'rgba(255, 76, 76, 0.15)',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  errorText: {
    color: '#FF4C4C',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
  },
  retryBtn: {
    backgroundColor: '#FF4C4C',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(62, 160, 255, 0.1)',
    paddingVertical: 10,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusText: {
    color: '#3EA0FF',
    fontSize: 14,
    marginLeft: 10,
  },
  videoContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A2634',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 21, 35, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    color: '#B0B8C3',
    fontSize: 14,
    marginTop: 12,
  },
  infoCard: {
    backgroundColor: 'rgba(26, 38, 52, 0.8)',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    color: '#718096',
    fontSize: 14,
  },
  infoValue: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
  },
  helperText: {
    color: '#4A5568',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
});
