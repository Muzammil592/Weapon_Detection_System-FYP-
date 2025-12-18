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
import { useAuth, UserStorage, SettingsStorage } from '../utils';

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
}) => (
  <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress && !rightElement}>
    <View style={styles.settingIconContainer}>
      <Icon name={icon} size={22} color="#3EA0FF" />
    </View>
    <View style={styles.settingContent}>
      <Text style={styles.settingTitle}>{title}</Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
    </View>
    {rightElement || (
      <Icon name="chevron-forward" size={20} color="#4A5568" />
    )}
  </TouchableOpacity>
);

export default function ExploreScreen() {
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: logout,
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileAvatar}>
            <Icon name="person" size={32} color="#FFFFFF" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'user@example.com'}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Icon name="create-outline" size={20} color="#3EA0FF" />
          </TouchableOpacity>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionCard}>
            <SettingItem
              icon="notifications-outline"
              title="Push Notifications"
              subtitle="Receive alert notifications"
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#2D3F52', true: '#3EA0FF40' }}
                  thumbColor={notificationsEnabled ? '#3EA0FF' : '#718096'}
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
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: '#2D3F52', true: '#3EA0FF40' }}
                  thumbColor={soundEnabled ? '#3EA0FF' : '#718096'}
                />
              }
            />
            <SettingItem
              icon="phone-portrait-outline"
              title="Vibration"
              rightElement={
                <Switch
                  value={vibrationEnabled}
                  onValueChange={setVibrationEnabled}
                  trackColor={{ false: '#2D3F52', true: '#3EA0FF40' }}
                  thumbColor={vibrationEnabled ? '#3EA0FF' : '#718096'}
                />
              }
            />
          </View>
        </View>

        {/* Camera Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Camera</Text>
          <View style={styles.sectionCard}>
            <SettingItem
              icon="videocam-outline"
              title="Camera Configuration"
              subtitle="Manage CCTV settings"
              onPress={() => {}}
            />
            <SettingItem
              icon="speedometer-outline"
              title="Stream Quality"
              subtitle="High (1080p)"
              onPress={() => {}}
            />
            <SettingItem
              icon="refresh-outline"
              title="Auto Reconnect"
              subtitle="Enabled"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Detection Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detection</Text>
          <View style={styles.sectionCard}>
            <SettingItem
              icon="shield-checkmark-outline"
              title="Detection Sensitivity"
              subtitle="High"
              onPress={() => {}}
            />
            <SettingItem
              icon="alert-circle-outline"
              title="Alert Threshold"
              subtitle="75%"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.sectionCard}>
            <SettingItem
              icon="moon-outline"
              title="Dark Mode"
              subtitle="Always on"
              onPress={() => {}}
            />
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
          <Icon name="log-out-outline" size={22} color="#FF4444" />
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
    backgroundColor: '#0A1523',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#0C1B2A',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2634',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3EA0FF',
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
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 14,
    color: '#718096',
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
    color: '#718096',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: '#1A2634',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3F52',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#3EA0FF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FF444415',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF444440',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4444',
    marginLeft: 8,
  },
  spacer: {
    height: 120,
  },
});
