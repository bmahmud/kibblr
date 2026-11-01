import { useColorScheme } from 'react-native';

import { darkColors, lightColors, radius, spacing, touchTarget, typography } from './tokens';
import type { ColorTokens } from './tokens';

export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  touchTarget: typeof touchTarget;
};

export function getTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    touchTarget,
  };
}

export function useTheme(): Theme {
  return getTheme(useColorScheme() === 'dark' ? 'dark' : 'light');
}

export { darkColors, lightColors, radius, spacing, touchTarget, typography };
export type { ColorTokens };
