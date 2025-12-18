/**
 * Application Configuration
 * Centralized configuration for API endpoints and app settings
 */

// Environment configuration
const ENV = {
  development: {
    API_HOST: '192.168.100.35',
    API_PORT: '5000',
  },
  production: {
    API_HOST: '192.168.100.35',
    API_PORT: '5000',
  },
};

// Current environment
const currentEnv = __DEV__ ? 'development' : 'production';

// API Configuration
export const API_CONFIG = {
  HOST: ENV[currentEnv].API_HOST,
  PORT: ENV[currentEnv].API_PORT,
  get BASE_URL() {
    return `http://${this.HOST}:${this.PORT}`;
  },
  get AUTH_URL() {
    return `${this.BASE_URL}/api/auth`;
  },
  get DASHBOARD_URL() {
    return `${this.BASE_URL}/api/dashboard`;
  },
  get NOTIFICATIONS_URL() {
    return `${this.BASE_URL}/api/notifications`;
  },
  get STREAM_URL() {
    return `${this.BASE_URL}/api/stream`;
  },
  // Keep BASE_IP for backwards compatibility
  BASE_IP: ENV[currentEnv].API_HOST,
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: 'Weapon Detection System',
  VERSION: '1.0.0',
  STORAGE_KEYS: {
    USER_DATA: 'userData',
    AUTH_TOKEN: 'authToken',
    SETTINGS: 'appSettings',
  },
  TIMEOUTS: {
    API_REQUEST: 30000, // 30 seconds
    STREAM_CHECK: 3000, // 3 seconds
  },
};

// Theme Configuration
export const THEME_CONFIG = {
  colors: {
    primary: '#3B82F6',
    secondary: '#6366F1',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    background: {
      dark: '#0F172A',
      light: '#F8FAFC',
    },
    card: {
      dark: '#1E293B',
      light: '#FFFFFF',
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
      dark: '#1E293B',
    },
  },
};
