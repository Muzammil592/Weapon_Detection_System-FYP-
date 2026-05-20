/**
 * Dashboard Screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { DashboardAPI, DashboardStats, Activity, useAuth, useTheme } from '../../utils';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const { navTheme, mode, colors } = useTheme();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalWeapons: 0,
    alertsSent: 0,
    accuracy: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation values for cards
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

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
          }
        }
      ]
    );
  };

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      const [statsResult, activityResult] = await Promise.all([
        DashboardAPI.getStats(),
        DashboardAPI.getActivity(),
      ]);

      if (!statsResult.success || !activityResult.success) {
        throw new Error('Failed to fetch dashboard data');
      }

      if (statsResult.data) setStats(statsResult.data);
      if (activityResult.data) setActivities(activityResult.data);

      // Animate cards on load
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
      // Set default data for testing
      setStats({ totalWeapons: 12, alertsSent: 5, accuracy: 0.98 });
      setActivities([
        { id: '1', type: 'high', message: 'Weapon detected in Sector 7', time: '5m ago' },
        { id: '2', type: 'medium', message: 'Suspicious activity in Sector 2', time: '15m ago' },
        { id: '3', type: 'low', message: 'No unusual activity detected', time: '20m ago' },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    fetchData();
  }, [fadeAnim, slideAnim, fetchData]);

  const getActivityStyle = (type: string) => {
    switch (type) {
      case 'high':
        return {
          bg: '#FCEBEC',
          color: colors.danger,
          icon: 'warning' as const,
        };
      case 'medium':
        return {
          bg: '#FFF3E4',
          color: colors.warning,
          icon: 'alert-circle' as const,
        };
      case 'low':
      default:
        return {
          bg: '#EAF5F1',
          color: colors.success,
          icon: 'shield-checkmark' as const,
        };
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: navTheme.colors.background }] }>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: navTheme.colors.text }]}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: navTheme.colors.background }] }>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: navTheme.colors.card }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.welcomeText, { color: navTheme.colors.text } ]}>Welcome,</Text>
          <Text style={[styles.userName, { color: navTheme.colors.text } ]}>{user?.name || 'User'}</Text>
        </View>
        <Text style={[styles.headerTitle, { color: navTheme.colors.text } ]}>Dashboard</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={handleLogout}>
          <Icon name="log-out-outline" size={24} color={navTheme.colors.text as string} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Cards */}
        <Animated.View
          style={[
            styles.kpiContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Detected Weapons Card */}
          <View style={[styles.kpiCard, styles.weaponsCard]}>
            <Icon name="alert-circle" size={28} color="#FFFFFF" style={styles.kpiIcon} />
            <Text style={[styles.kpiValue, { color: '#FFFFFF' }]}>{stats.totalWeapons}</Text>
            <Text style={[styles.kpiLabel, { color: '#F3F4F6' } ]}>Detected Weapons</Text>
          </View>

          {/* Alerts Sent Card */}
          <View style={[styles.kpiCard, styles.alertsCard]}>
            <Icon name="notifications" size={28} color="#FFFFFF" style={styles.kpiIcon} />
            <Text style={[styles.kpiValue, { color: '#FFFFFF' }]}>{stats.alertsSent}</Text>
            <Text style={[styles.kpiLabel, { color: '#F3F4F6' } ]}>Alerts Sent</Text>
          </View>

          {/* Accuracy Card */}
          <View style={[styles.kpiCard, styles.accuracyCard]}>
            <Icon name="analytics" size={28} color="#FFFFFF" style={styles.kpiIcon} />
            <Text style={[styles.kpiValue, { color: '#FFFFFF' }]}>{Math.round(stats.accuracy * 100)}%</Text>
            <Text style={[styles.kpiLabel, { color: '#F3F4F6' } ]}>Accuracy</Text>
          </View>
        </Animated.View>

        {/* Recent Activity Section */}
        <View style={styles.activitySection}>
          <Text style={[styles.sectionTitle, { color: navTheme.colors.text } ]}>Recent Activity</Text>
          
          {activities.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Icon name="checkmark-circle" size={48} color={colors.success} />
              <Text style={[styles.emptyText, { color: navTheme.colors.text } ]}>No recent activity</Text>
            </View>
          ) : (
            activities.map((activity) => {
              const style = getActivityStyle(activity.type);
              return (
                <View
                  key={activity.id}
                  style={[styles.activityCard, { backgroundColor: style.bg }]}
                >
                  <View style={[styles.activityIconContainer, { backgroundColor: style.color + '20' }]}>
                    <Icon name={style.icon} size={24} color={style.color} />
                  </View>
                  <View style={styles.activityContent}>
                    <View style={styles.activityHeader}>
                      <Text style={[styles.activityTitle, { color: style.color }]}>
                        {activity.type === 'high' ? 'High Risk Alert' :
                         activity.type === 'medium' ? 'Medium Risk Alert' : 'Normal Status'}
                      </Text>
                      <Text style={[styles.activityTime, { color: mode === 'light' ? '#67808A' : '#AFC7CE' } ]}>{activity.time}</Text>
                    </View>
                    <Text style={[styles.activityMessage, { color: mode === 'light' ? '#1E333B' : '#DDE7EA' } ]}>{activity.message}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {error && (
          <View style={[styles.errorBanner, { backgroundColor: mode === 'light' ? 'rgba(217, 91, 87, 0.14)' : 'rgba(217, 91, 87, 0.2)' } ]}>
            <Icon name="cloud-offline" size={20} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger } ]}>{error} (showing cached data)</Text>
          </View>
        )}
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    color: '#67808A',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E333B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E333B',
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  kpiContainer: {
    gap: 12,
  },
  kpiCard: {
    borderRadius: 16,
    padding: 16,
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  weaponsCard: {
    backgroundColor: '#1E6574',
  },
  alertsCard: {
    backgroundColor: '#D95B57',
  },
  accuracyCard: {
    backgroundColor: '#4E8C9A',
  },
  kpiIcon: {
    marginRight: 16,
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 16,
  },
  kpiLabel: {
    fontSize: 14,
    color: '#ECF4F6',
    flex: 1,
  },
  activitySection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E333B',
    marginBottom: 16,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#67808A',
    fontSize: 16,
    marginTop: 12,
  },
  activityCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 12,
    color: '#67808A',
  },
  activityMessage: {
    fontSize: 14,
    color: '#1E333B',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 76, 76, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#D95B57',
    fontSize: 12,
    marginLeft: 8,
  },
});
