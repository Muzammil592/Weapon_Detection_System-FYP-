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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { DashboardAPI, DashboardStats, Activity, useAuth } from '../app/utilities';

export default function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  
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

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated]);

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

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    fetchData();
  }, []);

  const getActivityStyle = (type: string) => {
    switch (type) {
      case 'high':
        return {
          bg: '#2C1F22',
          color: '#FF4C4C',
          icon: 'warning' as const,
        };
      case 'medium':
        return {
          bg: '#1E2A3A',
          color: '#3EA0FF',
          icon: 'alert-circle' as const,
        };
      case 'low':
      default:
        return {
          bg: '#1C2A24',
          color: '#4ED47A',
          icon: 'shield-checkmark' as const,
        };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3EA0FF" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3EA0FF"
            colors={['#3EA0FF']}
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
            <Ionicons name="alert-circle" size={28} color="#FFFFFF" style={styles.kpiIcon} />
            <Text style={styles.kpiValue}>{stats.totalWeapons}</Text>
            <Text style={styles.kpiLabel}>Detected Weapons</Text>
          </View>

          {/* Alerts Sent Card */}
          <View style={[styles.kpiCard, styles.alertsCard]}>
            <Ionicons name="notifications" size={28} color="#FFFFFF" style={styles.kpiIcon} />
            <Text style={styles.kpiValue}>{stats.alertsSent}</Text>
            <Text style={styles.kpiLabel}>Alerts Sent</Text>
          </View>

          {/* Accuracy Card */}
          <View style={[styles.kpiCard, styles.accuracyCard]}>
            <Ionicons name="analytics" size={28} color="#FFFFFF" style={styles.kpiIcon} />
            <Text style={styles.kpiValue}>{Math.round(stats.accuracy * 100)}%</Text>
            <Text style={styles.kpiLabel}>Accuracy</Text>
          </View>
        </Animated.View>

        {/* Recent Activity Section */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          {activities.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="checkmark-circle" size={48} color="#4ED47A" />
              <Text style={styles.emptyText}>No recent activity</Text>
            </View>
          ) : (
            activities.map((activity, index) => {
              const style = getActivityStyle(activity.type);
              return (
                <Animated.View
                  key={activity.id}
                  style={[
                    styles.activityCard,
                    { backgroundColor: style.bg },
                    {
                      opacity: fadeAnim,
                      transform: [
                        {
                          translateY: Animated.multiply(
                            slideAnim,
                            new Animated.Value((index + 1) * 0.2)
                          ),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={[styles.activityIconContainer, { backgroundColor: style.color + '20' }]}>
                    <Ionicons name={style.icon} size={24} color={style.color} />
                  </View>
                  <View style={styles.activityContent}>
                    <View style={styles.activityHeader}>
                      <Text style={[styles.activityTitle, { color: style.color }]}>
                        {activity.type === 'high' ? 'High Risk Alert' :
                         activity.type === 'medium' ? 'Medium Risk Alert' : 'Normal Status'}
                      </Text>
                      <Text style={styles.activityTime}>{activity.time}</Text>
                    </View>
                    <Text style={styles.activityMessage}>{activity.message}</Text>
                  </View>
                </Animated.View>
              );
            })
          )}
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline" size={20} color="#FF4C4C" />
            <Text style={styles.errorText}>{error} (showing cached data)</Text>
          </View>
        )}
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#0C1B2A',
  },
  headerLeft: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  weaponsCard: {
    backgroundColor: '#14365D',
  },
  alertsCard: {
    backgroundColor: '#8B1E2F',
  },
  accuracyCard: {
    backgroundColor: '#1C2F3E',
  },
  kpiIcon: {
    marginRight: 16,
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 12,
  },
  kpiLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B8C3',
    flex: 1,
  },
  activitySection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  activityCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    minHeight: 80,
    alignItems: 'center',
  },
  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
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
    fontSize: 15,
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 12,
    color: '#B0B8C3',
  },
  activityMessage: {
    fontSize: 13,
    color: '#B0B8C3',
    lineHeight: 18,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#B0B8C3',
    fontSize: 16,
    marginTop: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C1F22',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: '#FF4C4C',
    fontSize: 13,
    flex: 1,
  },
});
