/**
 * Authority Alert Details Screen
 * Dedicated details view for authority alerts
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../utils/types';
import { AlertsAPI } from '../../utils/api';
import { useTheme } from '../../utils';

 type AuthorityAlertDetailsRouteProp = RouteProp<RootStackParamList, 'AuthorityAlertDetails'>;
 type AuthorityAlertDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AuthorityAlertDetailsScreen() {
  const navigation = useNavigation<AuthorityAlertDetailsNavigationProp>();
  const route = useRoute<AuthorityAlertDetailsRouteProp>();
  const { navTheme, colors } = useTheme();
  const { alert } = route.params;
  const isDetection = alert.source === 'detection';
  const [submitting, setSubmitting] = useState(false);
  const personInfo = alert.personInfo || {};
  const personName = alert.personName || (personInfo.Name as string) || (personInfo.name as string);
  const personDetails = Object.entries(personInfo)
    .filter(([key, value]) => key && value && key.toLowerCase() !== 'name')
    .map(([key, value]) => `${key}: ${value}`);

  const time = new Date(alert.createdAt).toLocaleTimeString();
  const alertId = alert.id || alert._id || '#AX7-8B3-2C9';

  const handleAccept = async () => {
    if (!alertId || submitting) return;
    setSubmitting(true);
    const res = await AlertsAPI.accept(alertId as string);
    setSubmitting(false);
    if (!res.success) {
      Alert.alert('Error', res.error || 'Failed to accept alert.');
      return;
    }
    navigation.goBack();
  };

  const handleResolve = async () => {
    if (!alertId || submitting) return;
    setSubmitting(true);
    const res = await AlertsAPI.resolve(alertId as string);
    setSubmitting(false);
    if (!res.success) {
      Alert.alert('Error', res.error || 'Failed to resolve alert.');
      return;
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={navTheme.colors.text as string} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: navTheme.colors.text }]}>{isDetection ? 'Detection Details' : 'Alert Details'}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Screen Title */}
        <Text style={styles.screenTitle}>{isDetection ? 'DETECTION EVENT' : 'WEAPON DETECTED'}</Text>

        {/* New Alert chip */}
        <View style={styles.chipsRow}>
          <View style={styles.chipWarning}>
            <Text style={styles.chipWarningText}>{isDetection ? 'DETECTION' : 'NEW ALERT'}</Text>
          </View>
        </View>

        {/* Alert chips */}
        <View style={styles.chipsRow}>
          <View style={[styles.badge, { backgroundColor: '#FCEBEC' }]}> 
            <Icon name="alert-circle" size={18} color={colors.danger} />
            <Text style={[styles.badgeText, { color: '#B44D49' }]}>Weapon Detected</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: '#FFF3E4' }]}> 
            <Icon name="warning" size={18} color={colors.warning} />
            <Text style={[styles.badgeText, { color: '#B67D35' }]}>Activity: Suspicious</Text>
          </View>
        </View>

        {/* Person of Interest */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="person-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Person of Interest</Text>
          </View>
          {alert.imageUrl ? (
            <Image source={{ uri: alert.imageUrl }} style={styles.portrait} />
          ) : (
            <View style={[styles.portrait, styles.portraitPlaceholder]}>
              <Icon name="image-outline" size={36} color="#7B9198" />
            </View>
          )}
          <Text style={styles.descriptionText}>
            {personName ? `Face: ${personName}` : 'Face: Unknown'}
          </Text>
          {personDetails.length > 0 && (
            <Text style={styles.descriptionText}>{personDetails.join(' | ')}</Text>
          )}
        </View>

        {/* Location */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="location-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Location</Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 4 }]}> 
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>{alert.location || 'Unknown Location'}</Text>
          </View>
        </View>

        {/* Metadata */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Metadata</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Timestamp</Text>
            <Text style={styles.infoValue}>{time}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alert ID</Text>
            <Text style={styles.infoValue}>{alertId}</Text>
          </View>
        </View>

        {/* Actions */}
        {!isDetection && (
          <View style={[styles.actionsContainer, { flexDirection: 'row', gap: 8 }]}> 
            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={handleAccept} disabled={submitting}> 
              <Text style={styles.actionText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn, { flex: 1 }]} onPress={handleAccept} disabled={submitting}> 
              <Text style={[styles.actionText, styles.secondaryText]}>En-route</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn, { flex: 1 }]} onPress={handleResolve} disabled={submitting}> 
              <Text style={[styles.actionText, styles.secondaryText]}>Resolved</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F8F9' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16, backgroundColor: '#FFFFFF',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1E333B' },
  content: { flex: 1, padding: 16 },
  screenTitle: { color: '#B44D49', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  chipWarning: { backgroundColor: '#D95B57', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipWarningText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  badgeText: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#DDE7EA' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1E333B', marginLeft: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { fontSize: 14, color: '#67808A' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#1E333B' },
  descriptionText: { fontSize: 14, color: '#1E333B', lineHeight: 22 },
  portrait: { width: '100%', height: 180, borderRadius: 12, marginBottom: 8 },
  portraitPlaceholder: { backgroundColor: '#E2ECEF', justifyContent: 'center', alignItems: 'center' },
  snapshotContainer: { height: 200, backgroundColor: '#E2ECEF', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  snapshotText: { fontSize: 14, color: '#67808A', marginTop: 8 },
  map: { width: '100%', height: 180, borderRadius: 12 },
  actionsContainer: { gap: 12, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E6574', borderRadius: 12, paddingVertical: 14, gap: 8 },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1E6574' },
  actionText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  secondaryText: { color: '#1E6574' },
  spacer: { height: 100 },
});
