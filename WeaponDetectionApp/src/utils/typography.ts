import { Platform, Text, TextInput, TextStyle } from 'react-native';
import { THEME_CONFIG } from './config';

const BASE_FONT_FAMILY =
  Platform.select({
    android: THEME_CONFIG.typography.fontFamily.base,
    ios: 'System',
    default: 'sans-serif',
  }) || 'sans-serif';

const MEDIUM_FONT_FAMILY =
  Platform.select({
    android: THEME_CONFIG.typography.fontFamily.medium,
    ios: 'System',
    default: 'sans-serif-medium',
  }) || 'sans-serif-medium';

const BOLD_FONT_FAMILY =
  Platform.select({
    android: THEME_CONFIG.typography.fontFamily.bold,
    ios: 'System',
    default: 'sans-serif',
  }) || 'sans-serif';

export const APP_TYPOGRAPHY = {
  baseFontFamily: BASE_FONT_FAMILY,
  mediumFontFamily: MEDIUM_FONT_FAMILY,
  boldFontFamily: BOLD_FONT_FAMILY,
};

let typographyApplied = false;

export function applyGlobalTypography() {
  if (typographyApplied) {
    return;
  }

  typographyApplied = true;

  const textDefaults = ((Text as any).defaultProps || {}) as {
    style?: TextStyle | TextStyle[];
  };

  const textInputDefaults = ((TextInput as any).defaultProps || {}) as {
    style?: TextStyle | TextStyle[];
  };

  (Text as any).defaultProps = {
    ...textDefaults,
    style: [{ fontFamily: BASE_FONT_FAMILY, letterSpacing: 0.1 }, textDefaults.style],
  };

  (TextInput as any).defaultProps = {
    ...textInputDefaults,
    style: [{ fontFamily: BASE_FONT_FAMILY }, textInputDefaults.style],
    placeholderTextColor:
      textInputDefaults.placeholderTextColor || THEME_CONFIG.colors.input.placeholder,
  };
}
