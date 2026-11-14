/**
 * Design tokens. Screens read colors through `useTheme()` so dark mode and
 * the color themes work everywhere; never hard-code a hex value in a component.
 */

/** Stock status and verdict colors mean the same thing in every theme. */
const status = {
  light: { ok: '#2E8B57', low: '#B07A08', out: '#C93C3C', muted: '#5F5C54' },
  dark: { ok: '#4CB27A', low: '#E3A92B', out: '#E56262', muted: '#9C998F' },
} as const;

const BARCODE_INK = '#111111';

export type ColorTokens = {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  /** Behind product packshots, which are usually shot on white, and the barcode. */
  imageTile: string;
  /** Barcode bars: near-black on `imageTile` in every theme, so scanners can read it. */
  barcodeInk: string;
  /** stock status */
  statusOk: string;
  statusLow: string;
  statusOut: string;
  /** verdict badges */
  verdictReorder: string;
  verdictSkip: string;
  verdictUndecided: string;
};

type Base = Omit<
  ColorTokens,
  'barcodeInk' | 'statusOk' | 'statusLow' | 'statusOut' | 'verdictReorder' | 'verdictSkip' | 'verdictUndecided'
>;

function light(base: Base): ColorTokens {
  return {
    ...base,
    barcodeInk: BARCODE_INK,
    statusOk: status.light.ok,
    statusLow: status.light.low,
    statusOut: status.light.out,
    verdictReorder: status.light.ok,
    verdictSkip: status.light.out,
    verdictUndecided: base.textMuted,
  };
}

function dark(base: Base): ColorTokens {
  return {
    ...base,
    barcodeInk: BARCODE_INK,
    statusOk: status.dark.ok,
    statusLow: status.dark.low,
    statusOut: status.dark.out,
    verdictReorder: status.dark.ok,
    verdictSkip: status.dark.out,
    verdictUndecided: base.textMuted,
  };
}

export type ThemeId = 'kibble' | 'ocean' | 'sage' | 'berry';

export type ColorTheme = { id: ThemeId; label: string; light: ColorTokens; dark: ColorTokens };

/** The color themes offered in Settings. Each tints the backgrounds as well as the accent. */
export const THEMES: readonly ColorTheme[] = [
  {
    id: 'kibble',
    label: 'Kibble',
    light: light({
      background: '#F7F5F1',
      surface: '#FFFFFF',
      surfaceRaised: '#EFECE6',
      border: '#E2DDD4',
      text: '#161513',
      textMuted: '#5F5C54',
      primary: '#A85A1C',
      onPrimary: '#FFFFFF',
      imageTile: '#FFFFFF',
    }),
    dark: dark({
      background: '#161513',
      surface: '#1F1E1B',
      surfaceRaised: '#2A2925',
      border: '#2A2925',
      text: '#F7F7F5',
      textMuted: '#A3A096',
      primary: '#E08E45',
      onPrimary: '#161513',
      imageTile: '#F2F0EB',
    }),
  },
  {
    id: 'ocean',
    label: 'Ocean',
    light: light({
      background: '#F2F6FA',
      surface: '#FFFFFF',
      surfaceRaised: '#E6EDF5',
      border: '#D5E0EB',
      text: '#0F1720',
      textMuted: '#4F5E6E',
      primary: '#1F62AE',
      onPrimary: '#FFFFFF',
      imageTile: '#FFFFFF',
    }),
    dark: dark({
      background: '#0D1318',
      surface: '#151D24',
      surfaceRaised: '#1F2A34',
      border: '#1F2A34',
      text: '#F1F5F9',
      textMuted: '#98A6B5',
      primary: '#62A6F0',
      onPrimary: '#0D1318',
      imageTile: '#EEF2F6',
    }),
  },
  {
    id: 'sage',
    label: 'Sage',
    light: light({
      background: '#F3F6F1',
      surface: '#FFFFFF',
      surfaceRaised: '#E7ECE3',
      border: '#D7DFD1',
      text: '#131A11',
      textMuted: '#55604C',
      primary: '#3A6F47',
      onPrimary: '#FFFFFF',
      imageTile: '#FFFFFF',
    }),
    dark: dark({
      background: '#111510',
      surface: '#192017',
      surfaceRaised: '#242C21',
      border: '#242C21',
      text: '#F1F5EE',
      textMuted: '#9DA895',
      primary: '#86C495',
      onPrimary: '#111510',
      imageTile: '#EFF2EC',
    }),
  },
  {
    id: 'berry',
    label: 'Berry',
    light: light({
      background: '#F8F4F8',
      surface: '#FFFFFF',
      surfaceRaised: '#F0E7F0',
      border: '#E3D7E3',
      text: '#1A1219',
      textMuted: '#625761',
      primary: '#8A3786',
      onPrimary: '#FFFFFF',
      imageTile: '#FFFFFF',
    }),
    dark: dark({
      background: '#161115',
      surface: '#201A1F',
      surfaceRaised: '#2C242B',
      border: '#2C242B',
      text: '#F7F2F6',
      textMuted: '#ADA1AB',
      primary: '#D990D4',
      onPrimary: '#161115',
      imageTile: '#F3EEF2',
    }),
  },
];

export const DEFAULT_THEME: ThemeId = 'kibble';

export function themeById(id: ThemeId): ColorTheme {
  return THEMES.find((theme) => theme.id === id) ?? (THEMES[0] as ColorTheme);
}

/** The default theme's colors. */
export const lightColors: ColorTokens = themeById(DEFAULT_THEME).light;
export const darkColors: ColorTokens = themeById(DEFAULT_THEME).dark;

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
