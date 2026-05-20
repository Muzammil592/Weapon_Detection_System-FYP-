import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TextInput, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { AlertsAPI } from '../../utils/api';
import { AuthorityAlert } from '../../utils/types';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../utils';

interface SectionData {
  title: string; // e.g., Dec 19, 2025
  data: AuthorityAlert[];
}

const statusLabel = (s: AuthorityAlert['status']) => {
  switch (s) {
    case 'resolved':
      return { label: 'Resolved', color: '#2FAE85', bg: '#EAF5F1' };
    case 'dismissed':
      return { label: 'False Alarm', color: '#67808A', bg: '#EAF2F4' };
    case 'accepted':
      return { label: 'Escalated', color: '#E7A14E', bg: '#FFF3E4' };
    default:
      return { label: s, color: '#67808A', bg: '#EAF2F4' };
  }
};

function groupByDate(items: AuthorityAlert[]): SectionData[] {
  const map = new Map<string, AuthorityAlert[]>();
  for (const it of items) {
    const d = new Date(it.createdAt);
    const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  // Keep insertion order by date desc
  const entries = Array.from(map.entries());
  return entries.map(([title, data]) => ({ title, data }));
}

export default function AuthorityHistoryScreen() {
  const { navTheme, colors, mode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AuthorityAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AlertsAPI.getHistory({ q, type: typeFilter === 'all' ? undefined : typeFilter });
      if (res.success && res.data) {
        const data = (res.data as any[]).map((x: any) => ({ ...x, id: x._id || x.id }));
        setItems(data);
      } else {
        setItems([]);
        setError(res.error || 'Failed to load history.');
      }
    } catch (err: any) {
      setItems([]);
      setError(err?.message || 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, [q, typeFilter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const filtered = useMemo(() => {
    const base = items.filter(i => {
      const matchesQ = q ? (i.title?.toLowerCase().includes(q.toLowerCase()) || i.message.toLowerCase().includes(q.toLowerCase()) || i.location?.toLowerCase().includes(q.toLowerCase())) : true;
      const matchesType = typeFilter === 'all' ? true : i.type === typeFilter;
      return matchesQ && matchesType;
    });

    // sort by createdAt desc
    base.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return base;
  }, [items, q, typeFilter]);

  const sections = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Icon name="search" color={mode === 'light' ? '#67808A' : '#AFC7CE'} size={18} style={{ marginLeft: 12 }} />
        <TextInput
          placeholder="Search by location, incident, or ID"
          placeholderTextColor={mode === 'light' ? '#7B9198' : '#AFC7CE'}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={fetchHistory}
          style={[styles.searchInput, { color: navTheme.colors.text }]}
          returnKeyType="search"
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => { setQ(''); }} style={{ padding: 8 }}>
            <Icon name="close-circle" size={18} color={mode === 'light' ? '#7B9198' : '#AFC7CE'} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        <TouchableOpacity style={styles.filterChip} onPress={() => setDateModalVisible(true)}>
          <Icon name="calendar" size={16} color={mode === 'light' ? '#67808A' : '#AFC7CE'} />
          <Text style={styles.filterText}>Date Range</Text>
          <Icon name="chevron-down" size={16} color={mode === 'light' ? '#67808A' : '#AFC7CE'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip} onPress={() => setTypeModalVisible(true)}>
          <Icon name="options" size={16} color={mode === 'light' ? '#67808A' : '#AFC7CE'} />
          <Text style={styles.filterText}>Incident Type</Text>
          <Icon name="chevron-down" size={16} color={mode === 'light' ? '#67808A' : '#AFC7CE'} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}> 
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: '#67808A', marginTop: 12 }}>Loading history...</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id || (item as any)._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          renderItem={({ item }) => {
            const priorityColor = item.type === 'high' ? colors.danger : item.type === 'medium' ? colors.warning : colors.success;
            const pill = statusLabel(item.status);
            return (
              <View style={[styles.card, { borderColor: priorityColor + '55' }]}> 
                <View style={styles.cardRow}>
                  <View style={[styles.iconBubble, { backgroundColor: priorityColor + '22' }]}>
                    <Icon name={item.type === 'high' ? 'alert' : item.type === 'medium' ? 'warning' : 'information-circle'} size={18} color={priorityColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.title || 'Alert'}</Text>
                    <Text style={styles.subtitle}>{item.location || 'Unknown Location'}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: pill.bg }]}> 
                    <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Icon name={error ? 'alert-circle' : 'checkmark-circle'} size={48} color={error ? colors.warning : colors.success} />
              <Text style={{ color: error ? '#B67D35' : '#67808A', marginTop: 12 }}>
                {error ? error : 'No history to show'}
              </Text>
            </View>
          )}
        />
      )}

      {/* Date modal placeholder (non-functional demo) */}
      <Modal visible={dateModalVisible} transparent animationType="fade" onRequestClose={() => setDateModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Date Range</Text>
            <Text style={styles.modalHint}>Preset ranges coming soon. For now, history loads latest data.</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setDateModalVisible(false)}>
              <Text style={styles.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Type modal */}
      <Modal visible={typeModalVisible} transparent animationType="fade" onRequestClose={() => setTypeModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Incident Type</Text>
            {(['all','high','medium','low'] as const).map(t => (
              <TouchableOpacity key={t} style={[styles.typeItem, typeFilter===t && styles.typeItemActive]} onPress={() => { setTypeFilter(t); setTypeModalVisible(false); }}>
                <Text style={[styles.typeText, typeFilter===t && styles.typeTextActive]}>{t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.modalBtn, { marginTop: 8 }]} onPress={() => setTypeModalVisible(false)}>
              <Text style={styles.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F8F9' },
  searchRow: {
    marginTop: 52,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: { flex: 1, color: '#1E333B', paddingVertical: 12, paddingHorizontal: 12 },
  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF' },
  filterText: { color: '#67808A', fontWeight: '600' },
  sectionHeader: { color: '#67808A', fontSize: 12, marginTop: 16, marginBottom: 8, paddingHorizontal: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DDE7EA', padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBubble: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#1E333B', fontSize: 15, fontWeight: '600' },
  subtitle: { color: '#67808A', fontSize: 12, marginTop: 2 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 11, fontWeight: '700' },
  loading: { flex: 1, backgroundColor: '#F4F8F9', alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '86%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#DDE7EA' },
  modalTitle: { color: '#1E333B', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  modalHint: { color: '#67808A' },
  modalBtn: { marginTop: 16, backgroundColor: '#1E6574', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#FFFFFF', fontWeight: '600' },
  typeItem: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, marginTop: 6, backgroundColor: '#EAF2F4' },
  typeItemActive: { backgroundColor: '#D5E7EB' },
  typeText: { color: '#67808A', fontWeight: '600' },
  typeTextActive: { color: '#1E6574' },
});
