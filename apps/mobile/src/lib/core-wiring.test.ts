import { BASE_UNITS, isBaseUnit } from '@kibblr/core';

import { darkColors, lightColors } from '@/theme';

describe('@kibblr/core wiring', () => {
  it('resolves the workspace package through Jest', () => {
    expect(BASE_UNITS).toEqual(['g', 'ml']);
    expect(isBaseUnit('g')).toBe(true);
  });
});

describe('theme tokens', () => {
  it('defines the same color keys for light and dark', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });
});
