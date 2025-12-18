/**
 * Authentication Context
 * Provides global authentication state management for React Native CLI
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthAPI } from './api';
import { UserStorage } from './storage';
import { User, LoginFormData } from './types';

// Auth State Interface
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Auth Context Interface
interface AuthContextType extends AuthState {
  login: (credentials: LoginFormData) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<boolean>;
}

// Initial State
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState);

  // Initialize auth state from storage
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const [user, token] = await Promise.all([
        UserStorage.getUser(),
        UserStorage.getToken(),
      ]);

      if (user && token) {
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setState({
          ...initialState,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setState({
        ...initialState,
        isLoading: false,
        error: 'Failed to initialize authentication',
      });
    }
  };

  // Login function
  const login = useCallback(async (credentials: LoginFormData): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await AuthAPI.login(credentials);

      if (result.success && result.data) {
        const { user, token } = result.data;

        // Save to storage
        await Promise.all([
          UserStorage.setUser(user),
          UserStorage.setToken(token),
        ]);

        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Login failed',
        }));
        return false;
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Network error',
      }));
      return false;
    }
  }, []);

  // Logout function - now returns void, navigation handled by consumer
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await UserStorage.logout();
      setState({
        ...initialState,
        isLoading: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
      setState({
        ...initialState,
        isLoading: false,
      });
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    const user = await UserStorage.getUser();
    if (user) {
      setState(prev => ({ ...prev, user }));
    }
  }, []);

  // Update user data
  const updateUser = useCallback(async (updates: Partial<User>): Promise<boolean> => {
    if (!state.user) return false;

    const updatedUser = { ...state.user, ...updates };
    const success = await UserStorage.setUser(updatedUser);

    if (success) {
      setState(prev => ({ ...prev, user: updatedUser }));
    }

    return success;
  }, [state.user]);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    clearError,
    refreshUser,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
