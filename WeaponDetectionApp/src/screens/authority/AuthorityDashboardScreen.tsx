import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { AlertsAPI } from '../../utils/api';
import { AuthorityAlert } from '../../utils/types';
import { useAuth, useTheme } from '../../utils';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../utils/types';

export default function AuthorityDashboardScreen() {
  const { logout } = useAuth();
  const { navTheme, colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<'new' | 'my'>('new');
  const [newAlerts, setNewAlerts] = useState<AuthorityAlert[]>([]);
  const [myAlerts, setMyAlerts] = useState<AuthorityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [a, b] = await Promise.all([AlertsAPI.getFeed(), AlertsAPI.getMyActive()]);

      if (a.success && a.data) {
        setNewAlerts(a.data.map(x => ({ ...x, id: (x as any)._id || x.id })));
      } else {
        setNewAlerts([]);
      }
      if (b.success && b.data) {
        setMyAlerts(b.data.map(x => ({ ...x, id: (x as any)._id || x.id })));
      } else {
        setMyAlerts([]);
      }
    } catch (err) {
      setNewAlerts([]);
      setMyAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const accept = async (id?: string) => {
    if (!id) return;
    const res = await AlertsAPI.accept(id);
    if (res.success) load();
  };

  const dismiss = async (id?: string) => {
    if (!id) return;
    const res = await AlertsAPI.dismiss(id);
    if (res.success) load();
  };

  const openDetails = (alert: AuthorityAlert) => {
    navigation.navigate('AuthorityAlertDetails', { alert });
  };

  const renderItem = ({ item }: { item: AuthorityAlert }) => {
    const isDetection = item.source === 'detection';
    const color = item.type === 'high' ? colors.danger : item.type === 'medium' ? colors.warning : colors.success;
    const bg = item.type === 'high' ? '#FCEBEC' : item.type === 'medium' ? '#FFF3E4' : '#EAF5F1';
    return (
      <TouchableOpacity onPress={() => openDetails(item)} activeOpacity={0.8} style={[styles.card, { borderColor: color + '55', backgroundColor: bg }]}> 
        <View style={styles.cardHeader}>
          <Text style={[styles.priority, { color }]}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)} Priority
          </Text>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, { backgroundColor: '#E2ECEF', justifyContent: 'center', alignItems: 'center' }]}>
              <Icon name="image" size={20} color="#7B9198" />
            </View>
          )}
        </View>
        <Text style={styles.title}>{item.title || (isDetection ? 'Detection' : 'Alert')}</Text>
        <Text style={styles.subtitle}>{item.location || 'Unknown Location'} • {new Date(item.createdAt).toLocaleTimeString()}</Text>
        {isDetection && (
          <Text style={styles.metaLine}>
            {item.weaponType ? `Weapon: ${item.weaponType}` : 'Weapon detected'}
            {typeof item.confidence === 'number' ? ` • ${(item.confidence * 100).toFixed(1)}%` : ''}
          </Text>
        )}
        <View style={styles.actions}>
          {isDetection ? (
            <Text style={[styles.status, { color }]}>DETECTION</Text>
          ) : item.status === 'new' ? (
            <>
              <TouchableOpacity style={[styles.btn, styles.accept]} onPress={() => accept(item.id || (item as any)._id)}>
                <Icon name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.btnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.dismiss]} onPress={() => dismiss(item.id || (item as any)._id)}>
                <Icon name="close" size={16} color="#67808A" />
                <Text style={[styles.btnText, { color: '#67808A' }]}>Dismiss</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.status, { color }]}>{item.status.toUpperCase()}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const data = tab === 'new' ? newAlerts : myAlerts;

  if (loading) {
    return (
      <View style={styles.loading}> 
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: '#67808A', marginTop: 12 }}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Surveillance</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Icon name="shield-checkmark" size={22} color={navTheme.colors.text as string} />
          <TouchableOpacity
            accessibilityLabel="History"
            onPress={() => navigation.navigate('AuthorityHistory')}
          >
            <Icon name="time-outline" size={22} color={navTheme.colors.text as string} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Logout"
            onPress={() => {
              Alert.alert('Logout', 'Are you sure you want to logout?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: () => logout() },
              ]);
            }}
          >
            <Icon name="log-out-outline" size={22} color={navTheme.colors.text as string} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setTab('new')} style={[styles.tab, tab==='new' && styles.tabActive]}>
          <Text style={[styles.tabText, tab==='new' && styles.tabTextActive]}>New Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('my')} style={[styles.tab, tab==='my' && styles.tabActive]}>
          <Text style={[styles.tabText, tab==='my' && styles.tabTextActive]}>My Active Alerts</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        data={data}
        keyExtractor={(item) => (item.id || (item as any)._id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Icon name="checkmark-circle" size={48} color={colors.success} />
            <Text style={{ color: '#67808A', marginTop: 12 }}>No alerts to show</Text>
          </View>
        )}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F8F9' },
  header: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  headerTitle: { color: '#1E333B', fontSize: 18, fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, backgroundColor: '#EAF2F4' },
  tabActive: { backgroundColor: '#D5E7EB' },
  tabText: { color: '#67808A', fontWeight: '600' },
  tabTextActive: { color: '#1E6574' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priority: { fontSize: 12, fontWeight: '700' },
  thumbnail: { width: 48, height: 48, borderRadius: 8 },
  title: { color: '#1E333B', fontSize: 16, fontWeight: '600', marginTop: 8 },
  subtitle: { color: '#67808A', fontSize: 12, marginTop: 2 },
  metaLine: { color: '#67808A', fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 12, gap: 10, alignItems: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  accept: { backgroundColor: '#1E6574' },
  dismiss: { backgroundColor: '#E2ECEF' },
  btnText: { color: '#FFFFFF', fontWeight: '600' },
  status: { fontWeight: '700' },
  loading: { flex: 1, backgroundColor: '#F4F8F9', alignItems: 'center', justifyContent: 'center' },
});
