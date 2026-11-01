import { describe, expect, it } from 'vitest';

import { BASE_UNITS, isBaseUnit } from './units';

describe('isBaseUnit', () => {
  it('accepts every base unit', () => {
    for (const unit of BASE_UNITS) {
      expect(isBaseUnit(unit)).toBe(true);
    }
  });

  it('rejects display units and non-strings', () => {
    expect(isBaseUnit('lb')).toBe(false);
    expect(isBaseUnit('G')).toBe(false);
    expect(isBaseUnit(1)).toBe(false);
    expect(isBaseUnit(null)).toBe(false);
  });
});
