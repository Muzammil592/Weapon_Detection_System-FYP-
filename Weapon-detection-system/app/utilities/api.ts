/**
 * API Service Module
 * Centralized API calls with error handling and type safety
 */

import { API_CONFIG, APP_CONFIG } from './config';
import {
  ApiResponse,
  LoginResponse,
  LoginFormData,
  UserSignupFormData,
  AuthoritySignupFormData,
  DashboardStats,
  Activity,
  NotificationItem,
  StreamStatus,
} from './types';

// Generic fetch wrapper with error handling
async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeout: number = APP_CONFIG.TIMEOUTS.API_REQUEST
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP error! status: ${response.status}`,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout. Please try again.',
      };
    }

    return {
      success: false,
      error: error.message || 'Network error. Please try again.',
    };
  }
}

// Auth API
export const AuthAPI = {
  async login(credentials: LoginFormData): Promise<ApiResponse<LoginResponse>> {
    return fetchWithTimeout<LoginResponse>(
      `${API_CONFIG.AUTH_URL}/login`,
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      }
    );
  },

  async signupUser(data: UserSignupFormData): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.AUTH_URL}/signup/user`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  async signupAuthority(data: AuthoritySignupFormData): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.AUTH_URL}/signup/authority`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  async forgotPassword(email: string): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.AUTH_URL}/forgot-password`,
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
  },

  async resetPassword(token: string, password: string): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.AUTH_URL}/reset-password/${token}`,
      {
        method: 'POST',
        body: JSON.stringify({ password }),
      }
    );
  },

  getGoogleAuthUrl(): string {
    return `${API_CONFIG.AUTH_URL}/google`;
  },
};

// Dashboard API
export const DashboardAPI = {
  async getStats(): Promise<ApiResponse<DashboardStats>> {
    return fetchWithTimeout<DashboardStats>(`${API_CONFIG.DASHBOARD_URL}/stats`);
  },

  async getActivity(): Promise<ApiResponse<Activity[]>> {
    return fetchWithTimeout<Activity[]>(`${API_CONFIG.DASHBOARD_URL}/activity`);
  },
};

// Notifications API
export const NotificationsAPI = {
  async getAll(): Promise<ApiResponse<NotificationItem[]>> {
    return fetchWithTimeout<NotificationItem[]>(API_CONFIG.NOTIFICATIONS_URL);
  },

  async markAsRead(id: string): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.NOTIFICATIONS_URL}/${id}/read`,
      { method: 'PUT' }
    );
  },

  async markAllAsRead(): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.NOTIFICATIONS_URL}/read-all`,
      { method: 'PUT' }
    );
  },

  async delete(id: string): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.NOTIFICATIONS_URL}/${id}`,
      { method: 'DELETE' }
    );
  },

  async clearAll(): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.NOTIFICATIONS_URL}/clear`,
      { method: 'DELETE' }
    );
  },
};

// Stream API
export const StreamAPI = {
  async getStatus(): Promise<ApiResponse<StreamStatus>> {
    return fetchWithTimeout<StreamStatus>(`${API_CONFIG.STREAM_URL}/status`);
  },

  async start(): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.STREAM_URL}/start`,
      { method: 'POST' }
    );
  },

  async stop(): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.STREAM_URL}/stop`,
      { method: 'POST' }
    );
  },

  getHLSUrl(): string {
    return API_CONFIG.HLS_STREAM_URL;
  },
};
