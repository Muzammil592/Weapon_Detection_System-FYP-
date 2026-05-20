/**
 * Notification Details Screen
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, getNotificationTypeConfig, useTheme } from '../../utils';

type NotificationDetailsRouteProp = RouteProp<RootStackParamList, 'NotificationDetails'>;
type NotificationDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationDetailsScreen() {
  const navigation = useNavigation<NotificationDetailsNavigationProp>();
  const route = useRoute<NotificationDetailsRouteProp>();
  const { navTheme, colors, mode } = useTheme();
  const { notification } = route.params;
  const config = getNotificationTypeConfig(notification.type);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={navTheme.colors.text as string} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: navTheme.colors.text }]}>Alert Details</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: config.iconColor + '20' }]}>
            <Icon name={config.iconName} size={20} color={config.iconColor} />
            <Text style={[styles.badgeText, { color: config.iconColor }]}>
              {notification.title}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: navTheme.colors.text }]}>Alert Information</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={[styles.infoValue, { color: navTheme.colors.text }]}>{notification.time}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={[styles.infoValue, { color: config.titleColor }]}>
              {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
            </Text>
          </View>
          {notification.location && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={[styles.infoValue, { color: navTheme.colors.text }]}>{notification.location}</Text>
            </View>
          )}
          {notification.confidence && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Confidence</Text>
              <Text style={[styles.infoValue, { color: colors.success }]}>
                {notification.confidence}%
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="document-text-outline" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: navTheme.colors.text }]}>Description</Text>
          </View>
          <Text style={[styles.descriptionText, { color: mode === 'light' ? '#1E333B' : '#DDE7EA' }]}>{notification.description}</Text>
        </View>

        {notification.imageUrl && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="person-outline" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: navTheme.colors.text }]}>Detected Face</Text>
            </View>
            <Image source={{ uri: notification.imageUrl }} style={styles.snapshot} />
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F8F9' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16, backgroundColor: '#FFFFFF' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1E333B' },
  content: { flex: 1, padding: 16 },
  badgeContainer: { alignItems: 'center', marginBottom: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  badgeText: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#DDE7EA' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1E333B', marginLeft: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { fontSize: 14, color: '#67808A' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#1E333B' },
  descriptionText: { fontSize: 14, color: '#1E333B', lineHeight: 22 },
  snapshot: { width: '100%', height: 220, borderRadius: 12, marginTop: 8, backgroundColor: '#DDE7EA' },
  spacer: { height: 100 },
});
