/**
 * Application Type Definitions
 * Centralized TypeScript interfaces and types
 */

// User Types
export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'user' | 'authority';
  cctvName?: string;
  rtspUrl?: string;
  location?: string;
  camera?: Camera;
}

export interface Authority {
  _id: string;
  name: string;
  email: string;
  officerId: string;
  stationName: string;
  role: 'authority';
}

// Camera Types
export interface Camera {
  camera_name: string;
  stream_url: string;
  location: string;
}

// Dashboard Types
export interface DashboardStats {
  totalWeapons: number;
  alertsSent: number;
  accuracy: number;
}

export interface Activity {
  id: string;
  type: 'high' | 'medium' | 'low';
  message: string;
  time: string;
}

// Notification Types
export type NotificationType = 'suspicious' | 'vehicle' | 'loitering' | 'package' | 'camera' | 'weapon' | 'system';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  time: string;
  description: string;
  icon: string;
  isRead: boolean;
  location?: string;
  confidence?: number;
}

export interface NotificationTypeConfig {
  iconName: string;
  iconColor: string;
  titleColor: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  role: string;
}

export interface StreamStatus {
  isRunning: boolean;
  hlsReady: boolean;
  error?: string;
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface UserSignupFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  cctvName: string;
  rtspUrl: string;
  location: string;
}

export interface AuthoritySignupFormData {
  name: string;
  email: string;
  officerId: string;
  stationName: string;
  password: string;
}

// Navigation Types
export type RootStackParamList = {
  Login: undefined;
  UserSignup: undefined;
  AuthoritySignup: undefined;
  MainTabs: undefined;
  NotificationDetails: { notification: NotificationItem };
};

export type MainTabsParamList = {
  Dashboard: undefined;
  LiveFeed: undefined;
  Notifications: undefined;
  AllNotifications: undefined;
  Explore: undefined;
};
