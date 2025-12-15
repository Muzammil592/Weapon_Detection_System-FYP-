import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { NotificationsAPI, NotificationItem, getNotificationTypeConfig } from '../app/utilities';

// Type configuration for icons and colors
const typeConfig: Record<string, { iconName: keyof typeof Ionicons.glyphMap; iconColor: string; titleColor: string }> = {
  suspicious: {
    iconName: 'warning',
    iconColor: '#FF4C4C',
    titleColor: '#FF6A6A',
  },
  weapon: {
    iconName: 'alert-circle',
    iconColor: '#FF4C4C',
    titleColor: '#FF6A6A',
  },
  vehicle: {
    iconName: 'car',
    iconColor: '#4AA9FF',
    titleColor: '#5FB3FF',
  },
  loitering: {
    iconName: 'person',
    iconColor: '#4ED47A',
    titleColor: '#78EBA0',
  },
  package: {
    iconName: 'cube',
    iconColor: '#FFDA5B',
    titleColor: '#FFD875',
  },
  camera: {
    iconName: 'videocam-off',
    iconColor: '#93B9FF',
    titleColor: '#A7C5FF',
  },
  system: {
    iconName: 'settings',
    iconColor: '#93B9FF',
    titleColor: '#A7C5FF',
  },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setError(null);
      const result = await NotificationsAPI.getAll();
      
      if (!result.success) {
        throw new Error('Failed to fetch notifications');
      }
      
      if (result.data) setNotifications(result.data);
    } catch (err) {
      console.error('Notifications fetch error:', err);
      setError('Failed to load notifications');
      // Set default data for testing
      setNotifications([
        {
          id: '1',
          type: 'suspicious',
          title: 'Suspicious Activity Detected',
          time: '10:30 AM',
          description: 'Unrecognized individual at main gate.',
          icon: 'warning',
          isRead: false,
        },
        {
          id: '2',
          type: 'vehicle',
          title: 'Unusual Vehicle Movement',
          time: '10:15 AM',
          description: 'Vehicle circling parking lot.',
          icon: 'car',
          isRead: false,
        },
        {
          id: '3',
          type: 'loitering',
          title: 'Person Loitering Near Entrance',
          time: '9:45 AM',
          description: 'Individual standing near entrance for extended period.',
          icon: 'person',
          isRead: true,
        },
        {
          id: '4',
          type: 'package',
          title: 'Package Left Unattended',
          time: '9:30 AM',
          description: 'Unattended package detected in Sector 2.',
          icon: 'cube',
          isRead: false,
        },
        {
          id: '5',
          type: 'camera',
          title: 'Camera Offline – Sector 3',
          time: '9:00 AM',
          description: 'Camera in Sector 3 has gone offline.',
          icon: 'videocam-off',
          isRead: true,
        },
        {
          id: '6',
          type: 'weapon',
          title: 'Weapon Detected',
          time: '8:45 AM',
          description: 'Potential weapon detected at main entrance.',
          icon: 'alert-circle',
          isRead: false,
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  const handleNotificationPress = (notification: NotificationItem) => {
    // Navigate to notification details
    router.push({
      pathname: '/notification-details' as any,
      params: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        time: notification.time,
        description: notification.description,
        icon: notification.icon,
        location: notification.location || '',
      },
    });
  };

  const getTypeConfig = (type: string) => {
    return typeConfig[type] || typeConfig.system;
  };

  const renderNotificationRow = ({ item }: { item: NotificationItem }) => {
    const config = getTypeConfig(item.type);
    
    return (
      <TouchableOpacity
        style={[styles.notificationCard, item.isRead && styles.notificationRead]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: config.iconColor + '20' }]}>
          <Ionicons name={config.iconName} size={24} color={config.iconColor} />
        </View>
        
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: config.titleColor }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.time}>{item.time}</Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        
        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={20} color="#7C8A9A" />
        </View>
        
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3EA0FF" />
        <Text style={styles.loadingText}>Loading Notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline" size={18} color="#FF4C4C" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotificationRow}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3EA0FF"
            colors={['#3EA0FF']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off" size={48} color="#7C8A9A" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1523',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A1523',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9BA7B6',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#0A1523',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#132436',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    position: 'relative',
  },
  notificationRead: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: '#7C8A9A',
  },
  description: {
    fontSize: 13,
    color: '#9BA7B6',
    lineHeight: 18,
  },
  arrowContainer: {
    paddingLeft: 8,
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3EA0FF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C1F22',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: {
    color: '#FF4C4C',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#7C8A9A',
    fontSize: 16,
    marginTop: 12,
  },
});
