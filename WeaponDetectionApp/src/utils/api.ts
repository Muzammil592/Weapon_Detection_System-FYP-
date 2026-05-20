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
  SignupOtpVerificationData,
  SignupOtpResendData,
  DashboardStats,
  Activity,
  NotificationItem,
  AuthorityAlert,
  AppSettings,
  UserCamera,
} from './types';
import { UserStorage } from './storage';

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

  async verifySignupOtp(data: SignupOtpVerificationData): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.AUTH_URL}/verify-signup-otp`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  async resendSignupOtp(data: SignupOtpResendData): Promise<ApiResponse<any>> {
    return fetchWithTimeout(
      `${API_CONFIG.AUTH_URL}/resend-signup-otp`,
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

// Cameras API
export const CamerasAPI = {
  async list(): Promise<ApiResponse<UserCamera[]>> {
    const token = await UserStorage.getToken();
    const res = await fetchWithTimeout<{ success: boolean; data?: { success: boolean; data?: UserCamera[]; error?: string }; error?: string }>(
      `${API_CONFIG.BASE_URL}/api/cameras`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );

    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to load cameras',
      };
    }

    const payload = res.data;
    if (!payload.success || !Array.isArray(payload.data)) {
      return {
        success: false,
        error: payload.error || 'Invalid cameras response from server',
      };
    }

    return {
      success: true,
      data: payload.data,
    };
  },

  async add(payload: {
    name: string;
    location: string;
    cameraIp?: string;
    cameraUsername?: string;
    cameraPassword?: string;
    cameraPort?: string;
    cameraBrand?: string;
    cameraPath?: string;
    rtspUrl?: string;
  }): Promise<ApiResponse<any>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout<any>(
      `${API_CONFIG.BASE_URL}/api/cameras`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
  },
};

// Settings API
export const SettingsAPI = {
  async get(): Promise<ApiResponse<AppSettings>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout<AppSettings>(
      `${API_CONFIG.BASE_URL}/api/settings`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
  },

  async update(settings: Partial<AppSettings>): Promise<ApiResponse<AppSettings>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout<AppSettings>(
      `${API_CONFIG.BASE_URL}/api/settings`,
      {
        method: 'PUT',
        body: JSON.stringify({ settings }),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
  },
};

// Dashboard API
export const DashboardAPI = {
  async getStats(): Promise<ApiResponse<DashboardStats>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout<DashboardStats>(
      `${API_CONFIG.DASHBOARD_URL}/stats`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
  },

  async getActivity(): Promise<ApiResponse<Activity[]>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout<Activity[]>(
      `${API_CONFIG.DASHBOARD_URL}/activity`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
  },
};

// Notifications API
export const NotificationsAPI = {
  async getAll(): Promise<ApiResponse<NotificationItem[]>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout<NotificationItem[]>(API_CONFIG.NOTIFICATIONS_URL, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  },

  async markAsRead(id: string): Promise<ApiResponse<any>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout(
      `${API_CONFIG.NOTIFICATIONS_URL}/${id}/read`,
      { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
  },

  async markAllAsRead(): Promise<ApiResponse<any>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout(
      `${API_CONFIG.NOTIFICATIONS_URL}/read-all`,
      { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
  },

  async delete(id: string): Promise<ApiResponse<any>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout(
      `${API_CONFIG.NOTIFICATIONS_URL}/${id}`,
      { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
  },
};

// Alerts API (Authority)
export const AlertsAPI = {
  async getFeed(): Promise<ApiResponse<AuthorityAlert[]>> {
    const token = await UserStorage.getToken();
    const res = await fetchWithTimeout<{ success: boolean; data?: AuthorityAlert[]; error?: string }>(
      `${API_CONFIG.ALERTS_URL}/feed`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
    if (!res.success || !res.data) {
      return { success: false, error: res.error || 'Failed to load feed' };
    }
    if (!res.data.success) {
      return { success: false, error: res.data.error || 'Failed to load feed' };
    }
    return { success: true, data: res.data.data || [] };
  },
  async getNew(): Promise<ApiResponse<AuthorityAlert[]>> {
    const token = await UserStorage.getToken();
    const res = await fetchWithTimeout<{ success: boolean; data?: AuthorityAlert[]; error?: string }>(
      `${API_CONFIG.ALERTS_URL}/new`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
    if (!res.success || !res.data) {
      return { success: false, error: res.error || 'Failed to load alerts' };
    }
    if (!res.data.success) {
      return { success: false, error: res.data.error || 'Failed to load alerts' };
    }
    return { success: true, data: res.data.data || [] };
  },

  async getMyActive(): Promise<ApiResponse<AuthorityAlert[]>> {
    const token = await UserStorage.getToken();
    const res = await fetchWithTimeout<{ success: boolean; data?: AuthorityAlert[]; error?: string }>(
      `${API_CONFIG.ALERTS_URL}/my-active`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
    if (!res.success || !res.data) {
      return { success: false, error: res.error || 'Failed to load alerts' };
    }
    if (!res.data.success) {
      return { success: false, error: res.data.error || 'Failed to load alerts' };
    }
    return { success: true, data: res.data.data || [] };
  },

  async accept(id: string): Promise<ApiResponse<any>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout(
      `${API_CONFIG.ALERTS_URL}/${id}/accept`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
  },

  async dismiss(id: string): Promise<ApiResponse<any>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout(
      `${API_CONFIG.ALERTS_URL}/${id}/dismiss`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
  },

  async resolve(id: string): Promise<ApiResponse<any>> {
    const token = await UserStorage.getToken();
    return fetchWithTimeout(
      `${API_CONFIG.ALERTS_URL}/${id}/resolve`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
  },

  async getHistory(params?: { type?: string; startDate?: string; endDate?: string; q?: string }): Promise<ApiResponse<AuthorityAlert[]>> {
    const token = await UserStorage.getToken();
    const query = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    const res = await fetchWithTimeout<{ success: boolean; data?: AuthorityAlert[]; error?: string }>(
      `${API_CONFIG.ALERTS_URL}/history${query}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    );
    if (!res.success || !res.data) {
      return { success: false, error: res.error || 'Failed to load history' };
    }
    if (!res.data.success) {
      return { success: false, error: res.data.error || 'Failed to load history' };
    }
    return { success: true, data: res.data.data || [] };
  },
};
