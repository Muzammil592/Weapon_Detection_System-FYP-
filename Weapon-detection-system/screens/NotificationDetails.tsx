import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

// Type configuration for icons and colors
const typeConfig: Record<string, { iconName: keyof typeof Ionicons.glyphMap; iconColor: string; titleColor: string; bgColor: string; label: string }> = {
  suspicious: {
    iconName: 'warning',
    iconColor: '#FF4C4C',
    titleColor: '#FF6A6A',
    bgColor: '#2C1F22',
    label: 'High Risk',
  },
  weapon: {
    iconName: 'alert-circle',
    iconColor: '#FF4C4C',
    titleColor: '#FF6A6A',
    bgColor: '#2C1F22',
    label: 'Critical Alert',
  },
  vehicle: {
    iconName: 'car',
    iconColor: '#4AA9FF',
    titleColor: '#5FB3FF',
    bgColor: '#1E2A3A',
    label: 'Medium Risk',
  },
  loitering: {
    iconName: 'person',
    iconColor: '#4ED47A',
    titleColor: '#78EBA0',
    bgColor: '#1C2A24',
    label: 'Low Risk',
  },
  package: {
    iconName: 'cube',
    iconColor: '#FFDA5B',
    titleColor: '#FFD875',
    bgColor: '#2A2820',
    label: 'Object Alert',
  },
  camera: {
    iconName: 'videocam-off',
    iconColor: '#93B9FF',
    titleColor: '#A7C5FF',
    bgColor: '#1E2536',
    label: 'System Alert',
  },
  system: {
    iconName: 'settings',
    iconColor: '#93B9FF',
    titleColor: '#A7C5FF',
    bgColor: '#1E2536',
    label: 'System',
  },
};

export default function NotificationDetails() {
  const params = useLocalSearchParams();
  
  const {
    type = 'system',
    title = 'Notification',
    time = '',
    description = '',
    location = '',
  } = params as {
    type?: string;
    title?: string;
    time?: string;
    description?: string;
    location?: string;
  };

  const config = typeConfig[type as string] || typeConfig.system;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alert Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Alert Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: config.iconColor + '20' }]}>
          <Ionicons name={config.iconName} size={16} color={config.iconColor} />
          <Text style={[styles.typeBadgeText, { color: config.iconColor }]}>
            {config.label}
          </Text>
        </View>

        {/* Main Icon */}
        <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.iconName} size={48} color={config.iconColor} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: config.titleColor }]}>{title}</Text>

        {/* Time */}
        <View style={styles.timeContainer}>
          <Ionicons name="time-outline" size={16} color="#7C8A9A" />
          <Text style={styles.timeText}>{time}</Text>
        </View>

        {/* Description Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Description</Text>
          <Text style={styles.cardText}>{description}</Text>
        </View>

        {/* Location Card (if available) */}
        {location ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Location</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={18} color="#4AA9FF" />
              <Text style={styles.locationText}>{location}</Text>
            </View>
          </View>
        ) : null}

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: config.iconColor }]} />
            <Text style={styles.statusText}>Active Alert</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={[styles.actionButton, styles.primaryButton]}>
            <Ionicons name="eye" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>View Camera Feed</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
            <Ionicons name="checkmark-circle" size={20} color="#4ED47A" />
            <Text style={styles.secondaryButtonText}>Mark as Resolved</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
            <Ionicons name="share-outline" size={20} color="#4AA9FF" />
            <Text style={styles.secondaryButtonText}>Share Alert</Text>
          </TouchableOpacity>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#0A1523',
  },
  backButton: {
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 20,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  timeText: {
    fontSize: 14,
    color: '#7C8A9A',
  },
  card: {
    backgroundColor: '#132436',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C8A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  actionsContainer: {
    marginTop: 12,
    marginBottom: 40,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#3E8FFF',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#132436',
    borderWidth: 1,
    borderColor: '#1E3A50',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
