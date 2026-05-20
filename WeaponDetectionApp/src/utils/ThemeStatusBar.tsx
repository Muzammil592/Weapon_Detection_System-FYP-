import React from 'react';
import { StatusBar } from 'react-native';
import { useTheme } from './ThemeContext';

function isDarkHexColor(hex: string) {
  const normalized = (hex || '').replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized;

  if (full.length !== 6) {
    return false;
  }

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return false;
  }

  const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
  return luminance < 150;
}

export default function ThemeStatusBar() {
  const { navTheme } = useTheme();
  const backgroundColor = (navTheme.colors.background as string) || '#FFFFFF';
  const isDark = isDarkHexColor(backgroundColor);

  return (
    <StatusBar
      barStyle={isDark ? 'light-content' : 'dark-content'}
      backgroundColor={backgroundColor}
    />
  );
}
