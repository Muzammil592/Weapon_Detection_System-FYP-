/**
 * Storage Service Module
 * Centralized AsyncStorage operations with type safety
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from './config';
import { User } from './types';

// Generic storage operations
export const Storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error reading ${key} from storage:`, error);
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing ${key} to storage:`, error);
      return false;
    }
  },

  async remove(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing ${key} from storage:`, error);
      return false;
    }
  },

  async clear(): Promise<boolean> {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  },
};

// User-specific storage operations
export const UserStorage = {
  async getUser(): Promise<User | null> {
    return Storage.get<User>(APP_CONFIG.STORAGE_KEYS.USER_DATA);
  },

  async setUser(user: User): Promise<boolean> {
    return Storage.set(APP_CONFIG.STORAGE_KEYS.USER_DATA, user);
  },

  async removeUser(): Promise<boolean> {
    return Storage.remove(APP_CONFIG.STORAGE_KEYS.USER_DATA);
  },

  async getToken(): Promise<string | null> {
    return Storage.get<string>(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  },

  async setToken(token: string): Promise<boolean> {
    return Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, token);
  },

  async removeToken(): Promise<boolean> {
    return Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  },

  async logout(): Promise<boolean> {
    try {
      await this.removeUser();
      await this.removeToken();
      return true;
    } catch (error) {
      console.error('Error during logout:', error);
      return false;
    }
  },
};

// Settings storage operations
export const SettingsStorage = {
  async getSettings<T>(): Promise<T | null> {
    return Storage.get<T>(APP_CONFIG.STORAGE_KEYS.SETTINGS);
  },

  async setSettings<T>(settings: T): Promise<boolean> {
    return Storage.set(APP_CONFIG.STORAGE_KEYS.SETTINGS, settings);
  },

  async updateSettings<T extends object>(updates: Partial<T>): Promise<boolean> {
    const current = await this.getSettings<T>();
    const updated = { ...current, ...updates } as T;
    return this.setSettings(updated);
  },
};
