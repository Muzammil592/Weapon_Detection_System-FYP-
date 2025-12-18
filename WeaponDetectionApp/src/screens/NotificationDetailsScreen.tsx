/**
 * Notification Details Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, getNotificationTypeConfig } from '../utils';

type NotificationDetailsRouteProp = RouteProp<RootStackParamList, 'NotificationDetails'>;
type NotificationDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationDetailsScreen() {
  const navigation = useNavigation<NotificationDetailsNavigationProp>();
  const route = useRoute<NotificationDetailsRouteProp>();
  const { notification } = route.params;
  const config = getNotificationTypeConfig(notification.type);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alert Details</Text>
        <TouchableOpacity style={styles.moreBtn}>
          <Icon name="ellipsis-horizontal" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Alert Type Badge */}
        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: config.iconColor + '20' }]}>
            <Icon name={config.iconName} size={20} color={config.iconColor} />
            <Text style={[styles.badgeText, { color: config.iconColor }]}>
              {notification.title}
            </Text>
          </View>
        </View>

        {/* Main Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="information-circle-outline" size={20} color="#3EA0FF" />
            <Text style={styles.cardTitle}>Alert Information</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{notification.time}</Text>
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
              <Text style={styles.infoValue}>{notification.location}</Text>
            </View>
          )}

          {notification.confidence && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Confidence</Text>
              <Text style={[styles.infoValue, { color: '#34C759' }]}>
                {notification.confidence}%
              </Text>
            </View>
          )}
        </View>

        {/* Description Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="document-text-outline" size={20} color="#3EA0FF" />
            <Text style={styles.cardTitle}>Description</Text>
          </View>
          <Text style={styles.descriptionText}>{notification.description}</Text>
        </View>

        {/* Snapshot Placeholder */}
        {notification.type === 'weapon' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="camera-outline" size={20} color="#3EA0FF" />
              <Text style={styles.cardTitle}>Detection Snapshot</Text>
            </View>
            <View style={styles.snapshotContainer}>
              <Icon name="image-outline" size={48} color="#4A5568" />
              <Text style={styles.snapshotText}>Snapshot not available</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionBtn}>
            <Icon name="videocam-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionText}>View Live Feed</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn]}>
            <Icon name="share-outline" size={24} color="#3EA0FF" />
            <Text style={[styles.actionText, styles.secondaryText]}>Share Alert</Text>
          </TouchableOpacity>
        </View>

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#0C1B2A',
  },
  backBtn: {
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
  moreBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#1A2634',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3F52',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#718096',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  descriptionText: {
    fontSize: 14,
    color: '#B0B8C3',
    lineHeight: 22,
  },
  snapshotContainer: {
    height: 200,
    backgroundColor: '#0C1B2A',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snapshotText: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3EA0FF',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3EA0FF',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#3EA0FF',
  },
  spacer: {
    height: 100,
  },
});
