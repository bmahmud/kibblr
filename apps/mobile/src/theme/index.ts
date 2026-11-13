import { useColorScheme } from 'react-native';

import { useThemePreferences } from './preferences';
import {
  DEFAULT_THEME,
  THEMES,
  darkColors,
  lightColors,
  radius,
  spacing,
  themeById,
  touchTarget,
  typography,
} from './tokens';
import type { ColorTheme, ColorTokens, ThemeId } from './tokens';

export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  touchTarget: typeof touchTarget;
};

export function getTheme(scheme: ColorScheme, themeId: ThemeId = DEFAULT_THEME): Theme {
  const theme = themeById(themeId);
  return {
    scheme,
    colors: scheme === 'dark' ? theme.dark : theme.light,
    spacing,
    radius,
    typography,
    touchTarget,
  };
}

/**
 * The current theme. Light or dark comes from `useColorScheme()`, which
 * follows the Appearance override set in the root layout.
 */
export function useTheme(): Theme {
  const themeId = useThemePreferences((state) => state.themeId);
  return getTheme(useColorScheme() === 'dark' ? 'dark' : 'light', themeId);
}

export { useThemePreferences } from './preferences';
export type { Appearance } from './preferences';
export { DEFAULT_THEME, THEMES, darkColors, lightColors, radius, spacing, themeById, touchTarget, typography };
export type { ColorTheme, ColorTokens, ThemeId };
