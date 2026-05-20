/**
 * Theme Context
 * Manages dark/light theme based on app settings
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
import { THEME_CONFIG } from './config';
import { AppSettings, ThemeMode } from './types';
import { SettingsStorage } from './storage';
import { SettingsAPI } from './api';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  navTheme: Theme;
  colors: typeof THEME_CONFIG.colors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    (async () => {
      const settings = await SettingsStorage.getSettings<AppSettings>();
      if (settings?.app?.theme) {
        setModeState(settings.app.theme);
      }
    })();
  }, []);

  const setMode = async (next: ThemeMode) => {
    setModeState(next);
    await SettingsStorage.updateSettings<AppSettings>({ app: { theme: next } });
    await SettingsAPI.update({ app: { theme: next } });
  };

  const navTheme: Theme = useMemo(() => {
    const base = mode === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: mode === 'light' ? THEME_CONFIG.colors.background.light : THEME_CONFIG.colors.background.dark,
        card: mode === 'light' ? THEME_CONFIG.colors.card.light : THEME_CONFIG.colors.card.dark,
        text: mode === 'light' ? THEME_CONFIG.colors.text.dark : THEME_CONFIG.colors.text.primary,
        primary: THEME_CONFIG.colors.primary,
        border: mode === 'light' ? THEME_CONFIG.colors.border.light : THEME_CONFIG.colors.border.dark,
        notification: THEME_CONFIG.colors.primary,
      },
    } as Theme;
  }, [mode]);

  const value: ThemeContextType = {
    mode,
    setMode,
    navTheme,
    colors: THEME_CONFIG.colors,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
