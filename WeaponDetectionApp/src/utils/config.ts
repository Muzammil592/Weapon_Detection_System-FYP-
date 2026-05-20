/**
 * Application Configuration
 * Centralized configuration for API endpoints and app settings
 */

// Environment configuration
// For Android emulator, 10.0.2.2 routes to the host machine.
// If you prefer ADB reverse, you can keep 127.0.0.1 and run:
//   adb reverse tcp:5000 tcp:5000
//   adb reverse tcp:8000 tcp:8000
const ENV = {
  development: {
    API_HOST: '10.0.2.2',
    API_PORT: '5000',
  },
  production: {
    API_HOST: '127.0.0.1',
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
  get ALERTS_URL() {
    return `${this.BASE_URL}/api/alerts`;
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
    // Screenshot-inspired palette (deep teal + soft neutral surfaces)
    primary: '#1E6574',
    secondary: '#4E8C9A',
    success: '#2FAE85',
    warning: '#E7A14E',
    danger: '#D95B57',
    accent: '#D5E7EB',
    background: {
      dark: '#EDF5F6',
      light: '#F4F8F9',
    },
    card: {
      dark: '#FFFFFF',
      light: '#FFFFFF',
    },
    border: {
      dark: '#D6E3E6',
      light: '#DDE7EA',
    },
    tab: {
      background: '#154D5A',
      inactive: '#AFC7CE',
    },
    input: {
      background: '#E2ECEF',
      placeholder: '#7B9198',
    },
    text: {
      primary: '#1E333B',
      secondary: '#67808A',
      dark: '#1E333B',
      inverse: '#FFFFFF',
    },
  },
  typography: {
    // Roboto is a Google font and native on Android.
    fontFamily: {
      base: 'Roboto',
      medium: 'Roboto-Medium',
      bold: 'Roboto-Bold',
    },
  },
};
