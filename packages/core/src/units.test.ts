import { describe, expect, it } from 'vitest';

import {
  BASE_UNITS,
  DISPLAY_UNITS,
  baseUnitOf,
  defaultSizeUnit,
  formatNumber,
  formatSize,
  fromBase,
  isBaseUnit,
  parseNumber,
  roundBase,
  sizeDisplayUnit,
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
    expect(isBaseUnit('count')).toBe(false);
    expect(isBaseUnit(1)).toBe(false);
    expect(isBaseUnit(null)).toBe(false);
  });
});

describe('DISPLAY_UNITS', () => {
  it('offers weight units for g and volume units (with cups) for ml', () => {
    expect(DISPLAY_UNITS.g).toEqual(['lb', 'oz', 'kg', 'g']);
    expect(DISPLAY_UNITS.ml).toEqual(['floz', 'cup', 'ml']);
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
    expect(roundBase(5443.108)).toBe(5443);
    expect(roundBase(28.5)).toBe(29);
    expect(roundBase(236.588)).toBe(237);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundBase(-0.2), 0)).toBe(true);
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

describe('sizeDisplayUnit', () => {
  it('uses pounds, or ounces under a pound, for lb households', () => {
    expect(sizeDisplayUnit({ amount: 5443, unit: 'g' }, 'lb')).toBe('lb');
    expect(sizeDisplayUnit({ amount: 85, unit: 'g' }, 'lb')).toBe('oz');
  });

  it('uses kilograms, or grams under a kilogram, for kg households', () => {
    expect(sizeDisplayUnit({ amount: 2000, unit: 'g' }, 'kg')).toBe('kg');
    expect(sizeDisplayUnit({ amount: 85, unit: 'g' }, 'kg')).toBe('g');
  });

  it('uses fluid ounces or millilitres for volume', () => {
    expect(sizeDisplayUnit({ amount: 355, unit: 'ml' }, 'lb')).toBe('floz');
    expect(sizeDisplayUnit({ amount: 355, unit: 'ml' }, 'kg')).toBe('ml');
  });
});

describe('formatSize', () => {
  it('formats a can or bag size in the household unit', () => {
    expect(formatSize({ amount: 85, unit: 'g' }, 'lb')).toBe('3 oz');
    expect(formatSize({ amount: 156, unit: 'g' }, 'lb')).toBe('5.5 oz');
    expect(formatSize({ amount: 7257, unit: 'g' }, 'lb')).toBe('16 lb');
    expect(formatSize({ amount: 454, unit: 'g' }, 'lb')).toBe('1 lb');
    expect(formatSize({ amount: 85, unit: 'g' }, 'kg')).toBe('85 g');
    expect(formatSize({ amount: 3400, unit: 'g' }, 'kg')).toBe('3.4 kg');
    expect(formatSize({ amount: 355, unit: 'ml' }, 'lb')).toBe('12 fl oz');
    expect(formatSize({ amount: 355, unit: 'ml' }, 'kg')).toBe('355 ml');
  });
});

describe('defaultSizeUnit', () => {
  it('starts bags and boxes on lb or kg, bottles on fl oz or ml, and the rest on oz or g', () => {
    expect(defaultSizeUnit('bag', 'lb')).toBe('lb');
    expect(defaultSizeUnit('box', 'kg')).toBe('kg');
    expect(defaultSizeUnit('bottle', 'lb')).toBe('floz');
    expect(defaultSizeUnit('bottle', 'kg')).toBe('ml');
    expect(defaultSizeUnit('can', 'lb')).toBe('oz');
    expect(defaultSizeUnit('pouch', 'kg')).toBe('g');
  });
});
