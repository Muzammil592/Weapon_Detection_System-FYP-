/**
 * Application Type Definitions
 * Centralized TypeScript interfaces and types
 */

// User Types
export interface User {
  _id: string;
  name: string;
  email: string;
  isVerified?: boolean;
  phone?: string;
  role: 'user' | 'authority';
  cctvName?: string;
  rtspUrl?: string;
  location?: string;
  camera?: Camera;
  cameras?: UserCamera[];
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

// Camera as stored on user profile
export interface UserCamera {
  id: string;
  name: string;
  rtspUrl: string;
  location: string;
  brand?: string;
}

// Settings Types
export type ThemeMode = 'dark' | 'light' | 'system';

export interface NotificationSettings {
  push: boolean;
  sound: boolean;
  vibration: boolean;
}

export interface DetectionSettings {
  sensitivity: 'low' | 'medium' | 'high';
  alertThreshold: number; // 0-100
}

export interface AppSettings {
  notifications: NotificationSettings;
  detection: DetectionSettings;
  app: { theme: ThemeMode };
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
  personName?: string;
  personScore?: number;
  personInfo?: Record<string, string>;
  // Optional extended fields for detailed alerts
  alertId?: string;
  activity?: string; // e.g., Suspicious
  person?: string;   // e.g., Unauthorized
  imageUrl?: string; // snapshot/person of interest
  mapUrl?: string;   // static map snapshot
}

// Alert Types for Authority dashboard
export type AlertPriority = 'high' | 'medium' | 'low';

export type AlertStatus = 'new' | 'accepted' | 'dismissed' | 'resolved';

export interface AuthorityAlert {
  _id: string;
  id?: string; // optional mapping convenience
  type: AlertPriority;
  title?: string;
  message: string;
  location?: string;
  imageUrl?: string;
  status: AlertStatus;
  createdAt: string;
  source?: 'alert' | 'detection';
  weaponType?: string;
  confidence?: number;
  cameraName?: string;
  personName?: string;
  personScore?: number;
  personInfo?: Record<string, string>;
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
  location: string;
  // Camera connection fields (used to generate RTSP on backend)
  cameraIp: string;
  cameraUsername: string;
  cameraPassword: string;
  cameraPort?: string;
  cameraBrand?: string;
  cameraPath?: string;
  // Optional direct RTSP for advanced usage / backward compatibility
  rtspUrl?: string;
}

export interface AuthoritySignupFormData {
  name: string;
  email: string;
  officerId: string;
  stationName: string;
  password: string;
}

export interface SignupOtpVerificationData {
  email: string;
  role: 'user' | 'authority';
  otp: string;
}

export interface SignupOtpResendData {
  email: string;
  role: 'user' | 'authority';
}

// Navigation Types
export type RootStackParamList = {
  Login: undefined;
  UserSignup: undefined;
  AuthoritySignup: undefined;
  MainTabs: undefined;
  NotificationDetails: { notification: NotificationItem };
  AuthorityAlertDetails: { alert: AuthorityAlert };
  AuthorityHistory: undefined;
};

export type MainTabsParamList = {
  Dashboard: undefined;
  LiveFeed: undefined;
  Notifications: undefined;
  AllNotifications: undefined;
  Explore: undefined;
};
