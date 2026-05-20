/**
 * Explore Screen
 * Settings and configuration screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth, SettingsStorage, useTheme } from '../../utils';
import { SettingsAPI } from '../../utils/api';
import { AppSettings } from '../../utils/types';

interface SettingItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
}) => {
  const { navTheme, mode, colors } = useTheme();
  return (
    <TouchableOpacity style={[styles.settingItem, { borderBottomColor: mode === 'light' ? '#DDE7EA' : '#2D3F52' }]} onPress={onPress} disabled={!onPress && !rightElement}>
      <View style={styles.settingIconContainer}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: navTheme.colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]}>{subtitle}</Text>}
      </View>
      {rightElement || (
        <Icon name="chevron-forward" size={20} color={mode === 'light' ? '#7B9198' : '#AFC7CE'} />
      )}
    </TouchableOpacity>
  );
};

export default function ExploreScreen() {
  const { user, logout } = useAuth();
  const { mode, navTheme, colors } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('high');
  const [alertThreshold, setAlertThreshold] = useState<number>(75);

  // Load settings on mount
  React.useEffect(() => {
    (async () => {
      const cached = await SettingsStorage.getSettings<AppSettings>();
      if (cached) {
        setNotificationsEnabled(!!cached.notifications?.push);
        setSoundEnabled(!!cached.notifications?.sound);
        setVibrationEnabled(!!cached.notifications?.vibration);
        if (cached.detection) {
          setSensitivity(cached.detection.sensitivity || 'high');
          setAlertThreshold(cached.detection.alertThreshold ?? 75);
        }
      }
      const resp = await SettingsAPI.get();
      if (resp.success && resp.data) {
        const s = resp.data;
        await SettingsStorage.setSettings<AppSettings>(s);
        setNotificationsEnabled(!!s.notifications?.push);
        setSoundEnabled(!!s.notifications?.sound);
        setVibrationEnabled(!!s.notifications?.vibration);
        if (s.detection) {
          setSensitivity(s.detection.sensitivity || 'high');
          setAlertThreshold(s.detection.alertThreshold ?? 75);
        }
      }
    })();
  }, []);

  const updateSetting = async (updates: Partial<AppSettings>) => {
    await SettingsStorage.updateSettings<AppSettings>(updates);
    await SettingsAPI.update(updates);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear App Data',
      'This will clear all cached data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await SettingsStorage.clearAll();
            Alert.alert('Success', 'App data cleared successfully');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: navTheme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: navTheme.colors.card }]}>
        <Text style={[styles.headerTitle, { color: navTheme.colors.text }]}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={[styles.profileSection, { backgroundColor: navTheme.colors.card }]}>
          <View style={styles.profileAvatar}>
            <Icon name="person" size={32} color="#FFFFFF" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: navTheme.colors.text }]}>{user?.name || 'User'}</Text>
            <Text style={[styles.profileEmail, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]}>{user?.email || 'user@example.com'}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Icon name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]}>Notifications</Text>
          <View style={[styles.sectionCard, { backgroundColor: navTheme.colors.card }]}>
            <SettingItem
              icon="notifications-outline"
              title="Push Notifications"
              subtitle="Receive alert notifications"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={async (val) => {
                    setNotificationsEnabled(val);
                    await updateSetting({ notifications: { push: val } });
                  }}
                  trackColor={{ false: mode === 'light' ? '#D6E3E6' : '#2D3F52', true: mode === 'light' ? '#D5E7EB' : '#1E657440' }}
                  thumbColor={notificationsEnabled ? colors.primary : mode === 'light' ? '#7B9198' : '#AFC7CE'}
                />
              }
            />
            <SettingItem
              icon="volume-high-outline"
              title="Sound"
              subtitle="Play sound on alerts"
              rightElement={
                <Switch
                  value={soundEnabled}
                  onValueChange={async (val) => {
                    setSoundEnabled(val);
                    await updateSetting({ notifications: { sound: val } });
                  }}
                  trackColor={{ false: mode === 'light' ? '#D6E3E6' : '#2D3F52', true: mode === 'light' ? '#D5E7EB' : '#1E657440' }}
                  thumbColor={soundEnabled ? colors.primary : mode === 'light' ? '#7B9198' : '#AFC7CE'}
                />
              }
            />
            <SettingItem
              icon="phone-portrait-outline"
              title="Vibration"
              rightElement={
                <Switch
                  value={vibrationEnabled}
                  onValueChange={async (val) => {
                    setVibrationEnabled(val);
                    await updateSetting({ notifications: { vibration: val } });
                  }}
                  trackColor={{ false: mode === 'light' ? '#D6E3E6' : '#2D3F52', true: mode === 'light' ? '#D5E7EB' : '#1E657440' }}
                  thumbColor={vibrationEnabled ? colors.primary : mode === 'light' ? '#7B9198' : '#AFC7CE'}
                />
              }
            />
          </View>
        </View>

        {/* Detection Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]}>Detection</Text>
          <View style={[styles.sectionCard, { backgroundColor: navTheme.colors.card }]}>
            <SettingItem
              icon="shield-checkmark-outline"
              title="Detection Sensitivity"
              subtitle={sensitivity.toUpperCase()}
              rightElement={
                <View style={{ flexDirection: 'row' }}>
                  {(['low','medium','high'] as const).map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.pill, sensitivity === level ? styles.pillActive : styles.pillInactive]}
                      onPress={async () => {
                        setSensitivity(level);
                        await updateSetting({ detection: { sensitivity: level } });
                      }}
                    >
                      <Text style={sensitivity === level ? styles.pillActiveText : styles.pillInactiveText}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              }
            />
            <SettingItem
              icon="alert-circle-outline"
              title="Alert Threshold"
              subtitle={`${alertThreshold}%`}
              rightElement={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={async () => {
                      const next = Math.max(0, alertThreshold - 5);
                      setAlertThreshold(next);
                      await updateSetting({ detection: { alertThreshold: next } });
                    }}
                  >
                    <Icon name="remove" size={18} color="#ffffff" />
                  </TouchableOpacity>
                  <Text style={{ color: navTheme.colors.text, marginHorizontal: 8 }}>{alertThreshold}%</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={async () => {
                      const next = Math.min(100, alertThreshold + 5);
                      setAlertThreshold(next);
                      await updateSetting({ detection: { alertThreshold: next } });
                    }}
                  >
                    <Icon name="add" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        </View>

        {/* (moved and functional above) */}

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]}>App</Text>
          <View style={[styles.sectionCard, { backgroundColor: navTheme.colors.card }]}>
            <SettingItem
              icon="information-circle-outline"
              title="About"
              subtitle="Version 1.0.0"
              onPress={() => {}}
            />
            <SettingItem
              icon="trash-outline"
              title="Clear App Data"
              onPress={handleClearData}
            />
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Icon name="log-out-outline" size={22} color={colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8F9',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E333B',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E6574',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E333B',
  },
  profileEmail: {
    fontSize: 14,
    color: '#67808A',
    marginTop: 4,
  },
  editBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#67808A',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE7EA',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1E657415',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#1E333B',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#67808A',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FCEBEC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5C7C5',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D95B57',
    marginLeft: 8,
  },
  spacer: {
    height: 120,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: '#D5E7EB',
    borderColor: '#1E6574',
  },
  pillInactive: {
    backgroundColor: 'transparent',
    borderColor: '#D6E3E6',
  },
  pillActiveText: {
    color: '#1E6574',
    textTransform: 'capitalize',
  },
  pillInactiveText: {
    color: '#67808A',
    textTransform: 'capitalize',
  },
  stepBtn: {
    backgroundColor: '#1E6574',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
