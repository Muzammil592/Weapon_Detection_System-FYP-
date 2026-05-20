/**
 * Helper Functions Module
 * Common utility functions used across the app
 */

import { NotificationTypeConfig } from './types';
import { THEME_CONFIG } from './config';

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation (minimum 6 characters)
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

// Phone number validation
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\-+()]{10,}$/;
  return phoneRegex.test(phone);
};

// Format time for display
export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Format date for display
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format relative time (e.g., "2 hours ago")
export const formatRelativeTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

// Format percentage
export const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

// Truncate text with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

// Notification type configuration
export const getNotificationTypeConfig = (type: string): NotificationTypeConfig => {
  const palette = THEME_CONFIG.colors;
  const configs: Record<string, NotificationTypeConfig> = {
    suspicious: {
      iconName: 'warning',
      iconColor: palette.danger,
      titleColor: '#B44D49',
    },
    weapon: {
      iconName: 'alert-circle',
      iconColor: palette.danger,
      titleColor: '#B44D49',
    },
    vehicle: {
      iconName: 'car',
      iconColor: palette.primary,
      titleColor: '#2B7585',
    },
    loitering: {
      iconName: 'person',
      iconColor: palette.success,
      titleColor: '#2A9071',
    },
    package: {
      iconName: 'cube',
      iconColor: palette.warning,
      titleColor: '#B67D35',
    },
    camera: {
      iconName: 'videocam',
      iconColor: palette.secondary,
      titleColor: '#3D707C',
    },
    system: {
      iconName: 'settings',
      iconColor: palette.primary,
      titleColor: '#2B7585',
    },
  };

  return configs[type] || configs.system;
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle function
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
