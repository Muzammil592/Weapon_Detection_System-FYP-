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
import { NotificationsAPI, NotificationItem, getNotificationTypeConfig, RootStackParamList, useSocket, useTheme } from '../../utils';

type NotificationsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AllNotificationsScreen() {
  const navigation = useNavigation<NotificationsNavigationProp>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { socket } = useSocket();
  const { navTheme, mode, colors } = useTheme();

  const fetchNotifications = async () => {
    try {
      console.log('Fetching notifications...');
      const result = await NotificationsAPI.getAll();
      console.log('Notifications API result:', result);
      if (result.success && result.data) {
        setNotifications(result.data);
      } else {
        setNotifications([]);
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

  useEffect(() => {
    if (socket) {
      const handleNotificationCreated = () => {
        fetchNotifications();
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
    if (!notification.isRead) {
      await NotificationsAPI.markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      );
    }
    navigation.navigate('NotificationDetails', { notification });
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const config = getNotificationTypeConfig(item.type);
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          { backgroundColor: navTheme.colors.card },
          !item.isRead && [styles.unreadCard, { backgroundColor: mode === 'light' ? '#EAF2F4' : '#264A57' }],
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: config.iconColor + '20' }]}> 
          <Icon name={config.iconName} size={24} color={config.iconColor} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: config.titleColor }]}>{item.title}</Text>
            <Text style={[styles.time, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]}>{item.time}</Text>
          </View>
          <Text style={[styles.description, { color: mode === 'light' ? '#1E333B' : '#DDE7EA' }]} numberOfLines={2}>{item.description}</Text>
          {item.location && (
            <View style={styles.locationRow}>
              <Icon name="location-outline" size={12} color={mode === 'light' ? '#67808A' : '#AFC7CE'} />
              <Text style={[styles.location, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]}>{item.location}</Text>
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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: navTheme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: navTheme.colors.card }]}>
        <Text style={[styles.headerTitle, { color: navTheme.colors.text }]}>All Notifications</Text>
        <TouchableOpacity style={styles.markAllBtn}>
          <Icon name="checkmark-done" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="notifications-off-outline" size={64} color={mode === 'light' ? '#7B9198' : '#AFC7CE'} />
          <Text style={[styles.emptyTitle, { color: navTheme.colors.text }]}>No Notifications</Text>
          <Text style={[styles.emptyText, { color: mode === 'light' ? '#67808A' : '#AFC7CE' }]}>You're all caught up!</Text>
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
              tintColor={colors.primary}
              colors={[colors.primary]}
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
    backgroundColor: '#F4F8F9',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F4F8F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#67808A',
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
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E333B',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  unreadCard: {
    backgroundColor: '#EAF2F4',
    borderLeftWidth: 3,
    borderLeftColor: '#1E6574',
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
    color: '#67808A',
  },
  description: {
    fontSize: 14,
    color: '#1E333B',
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  location: {
    fontSize: 12,
    color: '#67808A',
    marginLeft: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E6574',
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
    color: '#1E333B',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#67808A',
    marginTop: 8,
  },
});
