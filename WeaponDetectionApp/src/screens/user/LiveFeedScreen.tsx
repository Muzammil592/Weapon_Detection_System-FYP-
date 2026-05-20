import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, AppState, TextInput } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserStorage, useSocket, useTheme, CamerasAPI } from '../../utils';


export default function LiveFeedScreen() {
  interface CameraData {
    camera_name: string;
    stream_url: string;
    location: string;
    id?: string;
  }

  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamErrors, setStreamErrors] = useState<(string | null)[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState<boolean[]>([]);
  const [key, setKey] = useState(0); 
  const [detectionAlert, setDetectionAlert] = useState<{
    weaponType: string;
    confidence: number;
    cameraName?: string;
    faceDetected?: boolean;
    activityLabel?: string;
    isSuspiciousActivity?: boolean | null;
  } | null>(null);
  const vlcRefs = useRef<any[]>([]);
  const appState = useRef(AppState.currentState);
  const { socket, sendDetectionRequest } = useSocket();
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const { navTheme, mode, colors } = useTheme();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newCamera, setNewCamera] = useState({
    name: '',
    cameraIp: '',
    cameraUsername: '',
    cameraPassword: '',
    cameraPort: '',
    cameraBrand: '',
    location: '',
  });

  // Socket listener for weapon + optional face detection
  useEffect(() => {
    if (socket) {
      const handleWeaponDetected = (data: {
        weaponType: string;
        confidence: number;
        cameraName?: string;
        faceDetected?: boolean;
        imageUrl?: string;
        activityLabel?: string;
        isSuspiciousActivity?: boolean | null;
      }) => {
        setDetectionAlert({
          weaponType: data.weaponType,
          confidence: data.confidence,
          cameraName: data.cameraName,
          faceDetected: Boolean(data.faceDetected || data.imageUrl),
          activityLabel: data.activityLabel,
          isSuspiciousActivity: data.isSuspiciousActivity ?? null,
        });
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
        setUserId(userData?._id || (userData as any)?.id || '');
        console.log("DEBUG: Raw User Data from Storage:", userData);

        const primaryCameraObj = userData?.camera;
        const primaryRawUrl = primaryCameraObj?.rtsp_url || userData?.rtspUrl;

        const cameraList: CameraData[] = [];

        if (primaryRawUrl) {
          const optimizedUrl = primaryRawUrl.includes('subtype=0')
            ? primaryRawUrl.replace('subtype=0', 'subtype=1')
            : primaryRawUrl;

          cameraList.push({
            id: 'primary',
            camera_name: primaryCameraObj?.camera_name || userData?.cctvName || 'CCTV Camera',
            stream_url: optimizedUrl,
            location: primaryCameraObj?.location || userData?.location || 'Main Entrance',
          });
        }

        // Load extra cameras from backend
        const camerasResult = await CamerasAPI.list();
        if (camerasResult.success && camerasResult.data) {
          camerasResult.data.forEach((cam) => {
            // Avoid duplicating primary if backend returns it as first item
            if (cam.id === 'primary') return;
            const url = cam.rtspUrl;
            const optimizedUrl = url.includes('subtype=0')
              ? url.replace('subtype=0', 'subtype=1')
              : url;
            cameraList.push({
              id: cam.id,
              camera_name: cam.name,
              stream_url: optimizedUrl,
              location: cam.location,
            });
          });
        }

        setCameras(cameraList);
        setStreamErrors(new Array(cameraList.length).fill(null));
        setBuffering(new Array(cameraList.length).fill(true));
      } catch (error) {
        console.error('Error loading camera:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCamera();
  }, [key]);

  // Send detection request when stream is ready and camera/user info is available
  useEffect(() => {
    if (isPlaying && cameras.length > 0 && userId && sendDetectionRequest) {
      cameras.forEach((cam) => {
        sendDetectionRequest({
          stream_url: cam.stream_url,
          user: userId,
          location: cam.location,
          camera_name: cam.camera_name,
        });
      });
    }
  }, [isPlaying, cameras, userId, sendDetectionRequest]);

  const manualReload = useCallback(() => {
    setIsPlaying(false);
    setStreamErrors([]);
    setBuffering([]);
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
      <View style={[styles.container, { backgroundColor: navTheme.colors.background }] }>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: navTheme.colors.text }]}>Initializing Stream...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: navTheme.colors.background }] }>
      <View style={[styles.header, { backgroundColor: navTheme.colors.card }]}>
        <View>
          <Text style={[styles.title, { color: navTheme.colors.text }]}>Live Cameras</Text>
          <Text style={[styles.locationSub, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]}>{userName}</Text>
        </View>
        <TouchableOpacity onPress={manualReload} style={styles.refreshIcon}>
          <Icon name="refresh-circle" size={35} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {detectionAlert && (
        <View
          style={[
            styles.alertBanner,
            detectionAlert.isSuspiciousActivity === false
              ? styles.alertBannerNonSuspicious
              : detectionAlert.faceDetected
                ? styles.alertBannerFace
                : null,
          ]}
        >
          <Icon
            name={
              detectionAlert.isSuspiciousActivity === false
                ? 'checkmark-circle-outline'
                : detectionAlert.faceDetected
                  ? 'person-circle-outline'
                  : 'warning'
            }
            size={24}
            color="#fff"
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.alertTitle}>
              {detectionAlert.isSuspiciousActivity === false
                ? 'Activity Non-Suspicious'
                : detectionAlert.faceDetected
                ? `Weapon (${detectionAlert.weaponType}) & Face Detected`
                : `Weapon Detected: ${detectionAlert.weaponType}`}
            </Text>
            <Text style={styles.alertSubtext}>
              {detectionAlert.isSuspiciousActivity === false
                ? `${detectionAlert.activityLabel ? `${detectionAlert.activityLabel} classified as non-suspicious.` : 'Behavior classified as non-suspicious.'}${detectionAlert.cameraName ? ` ${detectionAlert.cameraName}` : ''}`
                : detectionAlert.faceDetected
                ? `A face was captured near the ${detectionAlert.weaponType.toLowerCase()} detection${detectionAlert.cameraName ? ` on ${detectionAlert.cameraName}` : ''}.`
                : `${(detectionAlert.confidence * 100).toFixed(1)}% confidence${detectionAlert.cameraName ? ` - ${detectionAlert.cameraName}` : ''}`}
            </Text>
          </View>
        </View>
      )}

      {cameras.map((cam, index) => (
        <View key={cam.id || `cam-${index}`} style={styles.cameraCard}>
          <Text style={[styles.cameraTitle, { color: navTheme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {cam.camera_name}
          </Text>
          <Text style={[styles.cameraLocation, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]} numberOfLines={1} ellipsizeMode="tail">
            {cam.location}
          </Text>

          <View style={styles.videoContainer}>
            <VLCPlayer
              key={`vlc-instance-${key}-${index}`}
              ref={(ref) => { vlcRefs.current[index] = ref; }}
              style={styles.video}
              videoAspectRatio="16:9"
              autoplay={true}
              source={{
                uri: cam.stream_url,
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
                setIsPlaying(true);
                setBuffering(prev => {
                  const next = [...prev];
                  next[index] = false;
                  return next;
                });
                setStreamErrors(prev => {
                  const next = [...prev];
                  next[index] = null;
                  return next;
                });
              }}
              onBuffering={(e: any) => {
                setBuffering(prev => {
                  const next = [...prev];
                  next[index] = e.isBuffering;
                  return next;
                });
              }}
              onError={(e: any) => {
                console.log("DEBUG: VLC Error details:", e);
                setStreamErrors(prev => {
                  const next = [...prev];
                  next[index] = 'Stream error. Please check your camera configuration.';
                  return next;
                });
                setBuffering(prev => {
                  const next = [...prev];
                  next[index] = false;
                  return next;
                });
              }}
            />

            {(buffering[index] || streamErrors[index]) && (
              <View style={[styles.loadingOverlay, { backgroundColor: mode === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(10, 21, 35, 0.9)' }] }>
              {streamErrors[index] ? (
                <View style={styles.errorBox}>
                  <Icon name="videocam-off" size={40} color={colors.danger} />
                  <Text style={styles.errorText}>{streamErrors[index]}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={manualReload}>
                    <Text style={styles.retryText}>Retry Stream</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.bufferBox}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.bufferText, { color: mode === 'light' ? '#1E333B' : '#DDE7EA' }]}>Connecting to Camera...</Text>
                </View>
              )}
              </View>
            )}
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <View style={[styles.statusBadge, { backgroundColor: navTheme.colors.card }]}>
          <View style={[styles.dot, { backgroundColor: isPlaying ? colors.success : colors.danger }]} />
          <Text style={[styles.statusLabel, { color: navTheme.colors.text }]}>{isPlaying ? 'LIVE' : 'OFFLINE'}</Text>
        </View>
      </View>

      {/* Add More Camera Button / Popup */}
      {!showAddForm && (
        <View style={styles.addContainer}>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(true)}>
            <Icon name="add-circle" size={22} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add More Camera</Text>
          </TouchableOpacity>
        </View>
      )}

      {showAddForm && (
        <View style={[styles.addFormContainer, { backgroundColor: navTheme.colors.card }] }>
          <View style={styles.addFormHeader}>
            <Text style={[styles.addFormTitle, { color: navTheme.colors.text }]}>Add Camera</Text>
            <TouchableOpacity onPress={() => setShowAddForm(false)}>
              <Icon name="close" size={24} color={navTheme.colors.text as string} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <Icon name="videocam" size={18} color="#7B9198" style={styles.inputIcon} />
            <TextInput
              style={styles.formInput}
              placeholder="Camera Name *"
              placeholderTextColor="#7B9198"
              value={newCamera.name}
              onChangeText={(text) => setNewCamera(prev => ({ ...prev, name: text }))}
            />
          </View>

          <View style={styles.inputRow}>
            <Icon name="at" size={18} color="#7B9198" style={styles.inputIcon} />
            <TextInput
              style={styles.formInput}
              placeholder="Camera IP Address *"
              placeholderTextColor="#7B9198"
              value={newCamera.cameraIp}
              onChangeText={(text) => setNewCamera(prev => ({ ...prev, cameraIp: text }))}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputRow}>
            <Icon name="person-circle" size={18} color="#7B9198" style={styles.inputIcon} />
            <TextInput
              style={styles.formInput}
              placeholder="Camera Username *"
              placeholderTextColor="#7B9198"
              value={newCamera.cameraUsername}
              onChangeText={(text) => setNewCamera(prev => ({ ...prev, cameraUsername: text }))}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputRow}>
            <Icon name="key" size={18} color="#7B9198" style={styles.inputIcon} />
            <TextInput
              style={styles.formInput}
              placeholder="Camera Password *"
              placeholderTextColor="#7B9198"
              value={newCamera.cameraPassword}
              onChangeText={(text) => setNewCamera(prev => ({ ...prev, cameraPassword: text }))}
              secureTextEntry
            />
          </View>

          <View style={styles.inputRow}>
            <Icon name="wifi" size={18} color="#7B9198" style={styles.inputIcon} />
            <TextInput
              style={styles.formInput}
              placeholder="Port (optional, default 554)"
              placeholderTextColor="#7B9198"
              value={newCamera.cameraPort}
              onChangeText={(text) => setNewCamera(prev => ({ ...prev, cameraPort: text }))}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputRow}>
            <Icon name="aperture" size={18} color="#7B9198" style={styles.inputIcon} />
            <TextInput
              style={styles.formInput}
              placeholder="Brand (optional, e.g. Hikvision, Dahua)"
              placeholderTextColor="#7B9198"
              value={newCamera.cameraBrand}
              onChangeText={(text) => setNewCamera(prev => ({ ...prev, cameraBrand: text }))}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputRow}>
            <Icon name="location" size={18} color="#7B9198" style={styles.inputIcon} />
            <TextInput
              style={styles.formInput}
              placeholder="Location *"
              placeholderTextColor="#7B9198"
              value={newCamera.location}
              onChangeText={(text) => setNewCamera(prev => ({ ...prev, location: text }))}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, addLoading && styles.saveButtonDisabled]}
            onPress={async () => {
              if (!newCamera.name || !newCamera.cameraIp || !newCamera.cameraUsername || !newCamera.cameraPassword || !newCamera.location) {
                return;
              }
              try {
                setAddLoading(true);
                const result = await CamerasAPI.add({
                  name: newCamera.name,
                  location: newCamera.location,
                  cameraIp: newCamera.cameraIp,
                  cameraUsername: newCamera.cameraUsername,
                  cameraPassword: newCamera.cameraPassword,
                  cameraPort: newCamera.cameraPort || undefined,
                  cameraBrand: newCamera.cameraBrand || undefined,
                });
                if (result.success) {
                  // Refresh camera list to show new stream immediately
                  setNewCamera({
                    name: '',
                    cameraIp: '',
                    cameraUsername: '',
                    cameraPassword: '',
                    cameraPort: '',
                    cameraBrand: '',
                    location: '',
                  });
                  setShowAddForm(false);
                  setKey(prev => prev + 1);
                }
              } finally {
                setAddLoading(false);
              }
            }}
            disabled={addLoading}
          >
            {addLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Camera</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F8F9', paddingTop: 40 },
  loadingText: { color: '#67808A', marginTop: 10, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
  title: { color: '#1E333B', fontSize: 22, fontWeight: 'bold' },
  locationSub: { color: '#67808A', fontSize: 14 },
  refreshIcon: { padding: 5 },
  videoContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0F2830', marginVertical: 10, justifyContent: 'center', overflow: 'hidden' },
    cameraTitle: { color: '#1E333B', fontSize: 16, fontWeight: '600', paddingHorizontal: 20, paddingTop: 10 },
    cameraLocation: { color: '#67808A', fontSize: 12, paddingHorizontal: 20, paddingBottom: 5 },
  video: { width: '100%', height: '100%' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 21, 35, 0.9)', justifyContent: 'center', alignItems: 'center' },
  errorBox: { alignItems: 'center', padding: 20 },
  errorText: { color: '#D95B57', textAlign: 'center', marginTop: 10, marginBottom: 20 },
  retryBtn: { backgroundColor: '#1E6574', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: 'bold' },
  bufferBox: { alignItems: 'center' },
  bufferText: { color: '#1E333B', marginTop: 10, fontWeight: '500' },
  footer: { paddingHorizontal: 20, marginTop: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { color: '#1E333B', fontSize: 12, fontWeight: 'bold' },
  alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D95B57', paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 20, marginVertical: 10, borderRadius: 12 },
  alertBannerFace: { backgroundColor: '#2FAE85' },
  alertBannerNonSuspicious: { backgroundColor: '#2A9071' },
  alertTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  alertSubtext: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  addContainer: { paddingHorizontal: 20, paddingVertical: 10 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E6574', paddingVertical: 12, borderRadius: 12 },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  addFormContainer: { position: 'absolute', left: 20, right: 20, bottom: 30, borderRadius: 16, padding: 16, elevation: 10 },
  addFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addFormTitle: { fontSize: 18, fontWeight: 'bold' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E2ECEF', borderRadius: 10, paddingHorizontal: 10, marginBottom: 10 },
  inputIcon: { marginRight: 8 },
  formInput: { flex: 1, color: '#1E333B', fontSize: 14, paddingVertical: 8 },
  saveButton: { marginTop: 4, backgroundColor: '#1E6574', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
