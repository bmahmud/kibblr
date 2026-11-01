/**
 * Design tokens. Screens read colors through `useTheme()` so dark mode works
 * everywhere; never hard-code a hex value in a component.
 */

const palette = {
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F7F7F5',
  gray100: '#EFEEEA',
  gray200: '#E0DED8',
  gray400: '#9C998F',
  gray600: '#5F5C54',
  gray800: '#2A2925',
  gray850: '#1F1E1B',
  gray900: '#161513',
  kibble500: '#C8742E',
  kibble400: '#E08E45',
  kibble700: '#8F4F1B',
  green500: '#2E8B57',
  green400: '#4CB27A',
  amber500: '#C98A0B',
  amber400: '#E3A92B',
  red500: '#C93C3C',
  red400: '#E56262',
} as const;

export type ColorTokens = {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  /** stock status */
  statusOk: string;
  statusLow: string;
  statusOut: string;
  /** verdict badges */
  verdictReorder: string;
  verdictSkip: string;
  verdictUndecided: string;
};

export const lightColors: ColorTokens = {
  background: palette.gray50,
  surface: palette.white,
  surfaceRaised: palette.gray100,
  border: palette.gray200,
  text: palette.gray900,
  textMuted: palette.gray600,
  primary: palette.kibble500,
  onPrimary: palette.white,
  statusOk: palette.green500,
  statusLow: palette.amber500,
  statusOut: palette.red500,
  verdictReorder: palette.green500,
  verdictSkip: palette.red500,
  verdictUndecided: palette.gray600,
};

export const darkColors: ColorTokens = {
  background: palette.gray900,
  surface: palette.gray850,
  surfaceRaised: palette.gray800,
  border: palette.gray800,
  text: palette.gray50,
  textMuted: palette.gray400,
  primary: palette.kibble400,
  onPrimary: palette.gray900,
  statusOk: palette.green400,
  statusLow: palette.amber400,
  statusOut: palette.red400,
  verdictReorder: palette.green400,
  verdictSkip: palette.red400,
  verdictUndecided: palette.gray400,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  caption: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
} as const;

/** Minimum tappable size for one-handed use (Apple HIG minimum is 44). */
export const touchTarget = 48;
