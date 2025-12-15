/**
 * Helper Functions Module
 * Common utility functions used across the app
 */

import { NotificationTypeConfig } from './types';

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
  const configs: Record<string, NotificationTypeConfig> = {
    suspicious: {
      iconName: 'warning',
      iconColor: '#FF4C4C',
      titleColor: '#FF6A6A',
    },
    weapon: {
      iconName: 'alert-circle',
      iconColor: '#FF4C4C',
      titleColor: '#FF6A6A',
    },
    vehicle: {
      iconName: 'car',
      iconColor: '#4AA9FF',
      titleColor: '#5FB3FF',
    },
    loitering: {
      iconName: 'person',
      iconColor: '#4ED47A',
      titleColor: '#78EBA0',
    },
    package: {
      iconName: 'cube',
      iconColor: '#FFDA5B',
      titleColor: '#FFD875',
    },
    camera: {
      iconName: 'videocam-off',
      iconColor: '#93B9FF',
      titleColor: '#A7C5FF',
    },
    system: {
      iconName: 'settings',
      iconColor: '#93B9FF',
      titleColor: '#A7C5FF',
    },
  };

  return configs[type] || configs.system;
};

// Activity priority configuration
export const getActivityPriorityConfig = (priority: string): { color: string; bgColor: string } => {
  const configs: Record<string, { color: string; bgColor: string }> = {
    high: { color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
    medium: { color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' },
    low: { color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' },
  };

  return configs[priority] || configs.low;
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
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
