/**
 * Notifications Screen
 */

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
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NotificationsAPI, NotificationItem, getNotificationTypeConfig, RootStackParamList, useSocket } from '../utils';

type NotificationsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
  const navigation = useNavigation<NotificationsNavigationProp>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { socket } = useSocket();

  const fetchNotifications = async () => {
    try {
      const result = await NotificationsAPI.getAll();
      if (result.success && result.data) {
        setNotifications(result.data);
      } else {
        // Default data for testing
        setNotifications([
          {
            id: '1',
            type: 'weapon',
            title: 'Weapon Detected',
            time: '5 min ago',
            description: 'A potential weapon was detected in Zone A',
            icon: 'alert-circle',
            isRead: false,
            location: 'Zone A - Main Entrance',
          },
          {
            id: '2',
            type: 'suspicious',
            title: 'Suspicious Activity',
            time: '15 min ago',
            description: 'Unusual movement pattern detected',
            icon: 'warning',
            isRead: false,
            location: 'Zone B - Parking Lot',
          },
          {
            id: '3',
            type: 'system',
            title: 'System Update',
            time: '1 hour ago',
            description: 'Detection model updated successfully',
            icon: 'settings',
            isRead: true,
          },
        ]);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Socket listener for real-time notifications
  useEffect(() => {
    if (socket) {
      const handleNotificationCreated = () => {
        fetchNotifications(); // Refresh the list
      };

      socket.on('notification-created', handleNotificationCreated);

      return () => {
        socket.off('notification-created', handleNotificationCreated);
      };
    }
  }, [socket]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  const handleNotificationPress = async (notification: NotificationItem) => {
    // Mark as read
    if (!notification.isRead) {
      await NotificationsAPI.markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      );
    }
    
    // Navigate to details
    navigation.navigate('NotificationDetails', { notification });
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const config = getNotificationTypeConfig(item.type);
    
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: config.iconColor + '20' }]}>
          <Icon name={config.iconName} size={24} color={config.iconColor} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: config.titleColor }]}>{item.title}</Text>
            <Text style={styles.time}>{item.time}</Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          {item.location && (
            <View style={styles.locationRow}>
              <Icon name="location-outline" size={12} color="#718096" />
              <Text style={styles.location}>{item.location}</Text>
            </View>
          )}
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3EA0FF" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.markAllBtn}>
          <Icon name="checkmark-done" size={20} color="#3EA0FF" />
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="notifications-off-outline" size={64} color="#4A5568" />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptyText}>You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3EA0FF"
              colors={['#3EA0FF']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
    color: '#B0B8C3',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  markAllBtn: {
    padding: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#1A2634',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  unreadCard: {
    backgroundColor: '#1E2A3A',
    borderLeftWidth: 3,
    borderLeftColor: '#3EA0FF',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    color: '#718096',
  },
  description: {
    fontSize: 14,
    color: '#B0B8C3',
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  location: {
    fontSize: 12,
    color: '#718096',
    marginLeft: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3EA0FF',
    position: 'absolute',
    top: 16,
    right: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
  },
});
