import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, AppState } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserStorage, useSocket } from '../utils';


export default function LiveFeedScreen() {
  interface CameraData {
    camera_name: string;
    stream_url: string;
    location: string;
  }

  const [camera, setCamera] = useState<CameraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [key, setKey] = useState(0); 
  const [detectionAlert, setDetectionAlert] = useState<{weaponType: string; confidence: number} | null>(null);
  const vlcRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);
  const { socket, sendDetectionRequest } = useSocket();
  const [userName, setUserName] = useState<string>('');

  // Socket listener for weapon detection
  useEffect(() => {
    if (socket) {
      const handleWeaponDetected = (data: { weaponType: string; confidence: number }) => {
        setDetectionAlert(data);
        // Auto-hide after 10 seconds
        setTimeout(() => setDetectionAlert(null), 10000);
      };

      socket.on('weapon-detected', handleWeaponDetected);

      return () => {
        socket.off('weapon-detected', handleWeaponDetected);
      };
    }
  }, [socket]);

  // 1. Map Nested MongoDB Schema to State
  useEffect(() => {
    const loadCamera = async () => {
      try {
        const userData = await UserStorage.getUser();
        setUserName(userData?.name || '');
        console.log("DEBUG: Raw User Data from Storage:", userData);

        // DATA MAPPING: Based on your log, RTSP is at userData.camera.rtsp_url
        const cameraObj = userData?.camera;
        const rawUrl = cameraObj?.rtsp_url || userData?.rtspUrl;
        
        if (rawUrl) {
          const optimizedUrl = rawUrl.includes('subtype=0') 
            ? rawUrl.replace('subtype=0', 'subtype=1') 
            : rawUrl;

          setCamera({
            camera_name: cameraObj?.camera_name || userData?.cctvName || 'CCTV Camera',
            stream_url: optimizedUrl,
            location: cameraObj?.location || userData?.location || 'Main Entrance',
          });
          console.log("DEBUG: Final Stream URL ->", optimizedUrl);
        } else {
          setStreamError("No RTSP URL found in your account settings.");
        }
      } catch (error) {
        console.error('Error loading camera:', error);
        setStreamError("Failed to load camera configuration.");
      } finally {
        setLoading(false);
      }
    };
    loadCamera();
  }, [key]);

  // Send detection request when stream is ready and camera/user info is available
  useEffect(() => {
    if (isPlaying && camera && userName && sendDetectionRequest) {
      sendDetectionRequest({
        stream_url: camera.stream_url,
        user: userName,
        location: camera.location,
      });
    }
  }, [isPlaying, camera, userName, sendDetectionRequest]);

  const manualReload = useCallback(() => {
    setStreamError(null);
    setIsPlaying(false);
    setIsBuffering(true);
    setKey(prev => prev + 1); 
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        manualReload();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [manualReload]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3EA0FF" />
        <Text style={styles.loadingText}>Initializing Stream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{camera?.camera_name}</Text>
          <Text style={styles.locationSub}>{camera?.location}</Text>
        </View>
        <TouchableOpacity onPress={manualReload} style={styles.refreshIcon}>
          <Icon name="refresh-circle" size={35} color="#3EA0FF" />
        </TouchableOpacity>
      </View>

      {detectionAlert && (
        <View style={styles.alertBanner}>
          <Icon name="warning" size={24} color="#fff" />
          <Text style={styles.alertText}>
            Weapon Detected: {detectionAlert.weaponType} ({(detectionAlert.confidence * 100).toFixed(1)}%)
          </Text>
        </View>
      )}

      <View style={styles.videoContainer}>
        {camera?.stream_url ? (
          <VLCPlayer
            key={`vlc-instance-${key}`}
            ref={vlcRef}
            style={styles.video}
            videoAspectRatio="16:9"
            autoplay={true}
            source={{
              uri: camera.stream_url,
              initOptions: [
                '--rtsp-tcp',              // Required for Emulator NAT
                '--network-caching=500',   // Reduced buffer for faster start
                '--live-caching=500',
                '--avcodec-hw=none',       // Disable HW acceleration (Buggy on Emulators)
                '--no-audio',              // Speed up connection
                '--rtsp-frame-buffer-size=50000',
              ],
            }}
            onPlaying={() => {
              console.log("DEBUG: Stream Playing Successfully");
              setIsPlaying(true);
              setIsBuffering(false);
              setStreamError(null);
            }}
            onBuffering={(e: any) => {
              setIsBuffering(e.isBuffering);
            }}
            onError={(e: any) => {
              console.log("DEBUG: VLC Error details:", e);
              // If Error occurs, check if browser http://192.168.1.250 still works
              setStreamError("Handshake Error: Check if RTSP port 554 is blocked.");
              setIsPlaying(false);
              setIsBuffering(false);
            }}
          />
        ) : null}

        {/* Status Overlays */}
        {(isBuffering || streamError) && (
          <View style={styles.loadingOverlay}>
            {streamError ? (
              <View style={styles.errorBox}>
                <Icon name="videocam-off" size={40} color="#FF4C4C" />
                <Text style={styles.errorText}>{streamError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={manualReload}>
                  <Text style={styles.retryText}>Retry Stream</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.bufferBox}>
                <ActivityIndicator size="large" color="#3EA0FF" />
                <Text style={styles.bufferText}>Connecting to Camera...</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.statusBadge}>
          <View style={[styles.dot, { backgroundColor: isPlaying ? '#4ED47A' : '#FF4C4C' }]} />
          <Text style={styles.statusLabel}>{isPlaying ? 'LIVE' : 'OFFLINE'}</Text>
        </View>
        <Text style={styles.debugText}>URL: {camera?.stream_url}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1523', paddingTop: 40 },
  loadingText: { color: '#3EA0FF', marginTop: 10, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  locationSub: { color: '#718096', fontSize: 14 },
  refreshIcon: { padding: 5 },
  videoContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', marginVertical: 10, justifyContent: 'center', overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 21, 35, 0.9)', justifyContent: 'center', alignItems: 'center' },
  errorBox: { alignItems: 'center', padding: 20 },
  errorText: { color: '#FF4C4C', textAlign: 'center', marginTop: 10, marginBottom: 20 },
  retryBtn: { backgroundColor: '#3EA0FF', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: 'bold' },
  bufferBox: { alignItems: 'center' },
  bufferText: { color: '#3EA0FF', marginTop: 10, fontWeight: '500' },
  footer: { paddingHorizontal: 20, marginTop: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2634', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  debugText: { color: '#4A5568', fontSize: 10, marginTop: 15 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF4C4C', paddingHorizontal: 20, paddingVertical: 15, marginHorizontal: 20, marginVertical: 10, borderRadius: 10 },
  alertText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 }
});