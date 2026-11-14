import { BASE_UNITS, isBaseUnit } from '@kibblr/core';

import { THEMES, darkColors, lightColors } from '@/theme/tokens';

describe('@kibblr/core wiring', () => {
  it('resolves the workspace package through Jest', () => {
    expect(BASE_UNITS).toEqual(['g', 'ml']);
    expect(isBaseUnit('g')).toBe(true);
  });
});

/** WCAG relative luminance of a #RRGGBB color. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe('theme tokens', () => {
  it('defines the same color keys for light and dark', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  const schemes = THEMES.flatMap((theme) => [
    [`${theme.id} light`, theme.light] as const,
    [`${theme.id} dark`, theme.dark] as const,
  ]);

  it.each(schemes)('%s has every color key', (_name, colors) => {
    expect(Object.keys(colors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it.each(schemes)('%s keeps text and buttons readable (WCAG AA)', (_name, colors) => {
    expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(7);
    expect(contrast(colors.text, colors.surface)).toBeGreaterThanOrEqual(7);
    expect(contrast(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.primary, colors.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.barcodeInk, colors.imageTile)).toBeGreaterThanOrEqual(12);
  });
});
