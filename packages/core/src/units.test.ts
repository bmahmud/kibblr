import { describe, expect, it } from 'vitest';

import {
  BASE_UNITS,
  DISPLAY_UNITS,
  baseUnitOf,
  defaultInputUnit,
  formatAmount,
  formatDelta,
  formatNumber,
  fromBase,
  isBaseUnit,
  parseNumber,
  roundBase,
  toBase,
} from './units';

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

describe('DISPLAY_UNITS', () => {
  it('offers weight units for g, volume units (with cups) for ml, and count for count', () => {
    expect(DISPLAY_UNITS.g).toEqual(['lb', 'oz', 'kg', 'g']);
    expect(DISPLAY_UNITS.ml).toEqual(['floz', 'cup', 'ml']);
    expect(DISPLAY_UNITS.count).toEqual(['count']);
  });

  it('maps every display unit back to its base unit', () => {
    for (const base of BASE_UNITS) {
      for (const unit of DISPLAY_UNITS[base]) {
        expect(baseUnitOf(unit)).toBe(base);
      }
    }
  });
});

describe('roundBase', () => {
  it('rounds grams and millilitres to whole units', () => {
    expect(roundBase(5443.108, 'g')).toBe(5443);
    expect(roundBase(28.5, 'g')).toBe(29);
    expect(roundBase(236.588, 'ml')).toBe(237);
  });

  it('rounds counts to hundredths', () => {
    expect(roundBase(0.333333, 'count')).toBe(0.33);
    expect(roundBase(0.1 + 0.2, 'count')).toBe(0.3);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundBase(-0.2, 'g'), 0)).toBe(true);
  });
});

describe('toBase', () => {
  it('converts weights to whole grams', () => {
    expect(toBase(12, 'lb')).toBe(5443);
    expect(toBase(1, 'lb')).toBe(454);
    expect(toBase(5.5, 'oz')).toBe(156);
    expect(toBase(2, 'kg')).toBe(2000);
    expect(toBase(85, 'g')).toBe(85);
  });

  it('converts volumes to whole millilitres', () => {
    expect(toBase(1, 'cup')).toBe(237);
    expect(toBase(12, 'floz')).toBe(355);
    expect(toBase(500, 'ml')).toBe(500);
  });

  it('keeps fractional counts to hundredths', () => {
    expect(toBase(0.25, 'count')).toBe(0.25);
    expect(toBase(1 / 3, 'count')).toBe(0.33);
  });

  it('accepts zero', () => {
    expect(toBase(0, 'lb')).toBe(0);
  });

  it('rejects negative, NaN and infinite values', () => {
    expect(() => toBase(-1, 'lb')).toThrow(RangeError);
    expect(() => toBase(Number.NaN, 'g')).toThrow(RangeError);
    expect(() => toBase(Number.POSITIVE_INFINITY, 'ml')).toThrow(RangeError);
  });
});

describe('fromBase', () => {
  it('converts base amounts to the display unit without rounding', () => {
    expect(fromBase(453.59237, 'lb')).toBeCloseTo(1, 10);
    expect(fromBase(5443, 'lb')).toBeCloseTo(11.9998, 3);
    expect(fromBase(1000, 'kg')).toBe(1);
    expect(fromBase(236.5882365, 'cup')).toBeCloseTo(1, 10);
    expect(fromBase(3, 'count')).toBe(3);
  });

  it('round-trips through toBase within a gram', () => {
    for (const lb of [0.5, 3.3, 12, 30]) {
      expect(fromBase(toBase(lb, 'lb'), 'lb')).toBeCloseTo(lb, 2);
    }
  });
});

describe('parseNumber', () => {
  it('parses plain and decimal numbers, with a dot or a comma', () => {
    expect(parseNumber('12')).toBe(12);
    expect(parseNumber(' 1.5 ')).toBe(1.5);
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('2.')).toBe(2);
    expect(parseNumber('0')).toBe(0);
  });

  it('returns null for anything that is not a non-negative number', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
    expect(parseNumber('-1')).toBeNull();
    expect(parseNumber('1.2.3')).toBeNull();
    expect(parseNumber('12 lb')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('.')).toBeNull();
    expect(parseNumber('1e5')).toBeNull();
  });
});

describe('formatNumber', () => {
  it('shows at most one decimal and drops a trailing .0', () => {
    expect(formatNumber(7.25)).toBe('7.3');
    expect(formatNumber(7.04)).toBe('7');
    expect(formatNumber(12)).toBe('12');
    expect(formatNumber(0.04)).toBe('0');
    expect(formatNumber(1234.56)).toBe('1234.6');
  });

  it('never shows negative zero', () => {
    expect(formatNumber(-0.01)).toBe('0');
  });
});

describe('formatAmount', () => {
  it('shows pounds, or ounces under a pound, for lb households', () => {
    expect(formatAmount(3266, 'g', 'lb')).toBe('7.2 lb');
    expect(formatAmount(454, 'g', 'lb')).toBe('1 lb');
    expect(formatAmount(150, 'g', 'lb')).toBe('5.3 oz');
  });

  it('shows kilograms, or grams under a kilogram, for kg households', () => {
    expect(formatAmount(3400, 'g', 'kg')).toBe('3.4 kg');
    expect(formatAmount(1000, 'g', 'kg')).toBe('1 kg');
    expect(formatAmount(850, 'g', 'kg')).toBe('850 g');
  });

  it('shows zero in the larger unit', () => {
    expect(formatAmount(0, 'g', 'lb')).toBe('0 lb');
    expect(formatAmount(0, 'g', 'kg')).toBe('0 kg');
  });

  it('shows fluid ounces for lb households and millilitres for kg households', () => {
    expect(formatAmount(355, 'ml', 'lb')).toBe('12 fl oz');
    expect(formatAmount(355, 'ml', 'kg')).toBe('355 ml');
  });

  it('shows counts with a "ct" suffix', () => {
    expect(formatAmount(3, 'count', 'lb')).toBe('3 ct');
    expect(formatAmount(0.25, 'count', 'kg')).toBe('0.3 ct');
  });
});

describe('formatDelta', () => {
  it('signs the change', () => {
    expect(formatDelta(5443, 'g', 'lb')).toBe('+12 lb');
    expect(formatDelta(-150, 'g', 'lb')).toBe('−5.3 oz');
    expect(formatDelta(-1, 'count', 'lb')).toBe('−1 ct');
  });
});

describe('defaultInputUnit', () => {
  it('uses lb / fl oz for lb households and kg / ml for kg households', () => {
    expect(defaultInputUnit('g', 'lb')).toBe('lb');
    expect(defaultInputUnit('ml', 'lb')).toBe('floz');
    expect(defaultInputUnit('g', 'kg')).toBe('kg');
    expect(defaultInputUnit('ml', 'kg')).toBe('ml');
    expect(defaultInputUnit('count', 'lb')).toBe('count');
  });
});
