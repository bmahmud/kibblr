import { describe, expect, it } from 'vitest';

import { CONTAINER_LABELS, defaultContainer, formatCount, formatCountDelta, roundCount } from './count';
import { CATEGORIES, CONTAINERS } from './schemas';

describe('roundCount', () => {
  it('rounds to hundredths of a package', () => {
    expect(roundCount(1 / 3)).toBe(0.33);
    expect(roundCount(0.1 + 0.2)).toBe(0.3);
    expect(roundCount(12)).toBe(12);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundCount(-0.001), 0)).toBe(true);
  });
});

describe('formatCount', () => {
  it('uses the singular for exactly one', () => {
    expect(formatCount(1, 'can')).toBe('1 can');
    expect(formatCount(1, 'pouch')).toBe('1 pouch');
  });

  it('uses the plural for zero, many and fractions', () => {
    expect(formatCount(0, 'can')).toBe('0 cans');
    expect(formatCount(12, 'can')).toBe('12 cans');
    expect(formatCount(1.5, 'bag')).toBe('1.5 bags');
    expect(formatCount(0.25, 'bag')).toBe('0.25 bags');
  });

  it('knows the irregular plurals', () => {
    expect(formatCount(2, 'box')).toBe('2 boxes');
    expect(formatCount(3, 'pouch')).toBe('3 pouches');
    expect(formatCount(3, 'item')).toBe('3 items');
  });

  it('shows up to two decimals without trailing zeros', () => {
    expect(formatCount(2.5, 'tub')).toBe('2.5 tubs');
    expect(formatCount(2.004, 'tub')).toBe('2 tubs');
    expect(formatCount(1 / 3, 'tub')).toBe('0.33 tubs');
  });

  it('has a label for every container', () => {
    for (const container of CONTAINERS) {
      expect(CONTAINER_LABELS[container].one).toBe(container);
      expect(CONTAINER_LABELS[container].many).toMatch(/s$/);
    }
  });
});

describe('formatCountDelta', () => {
  it('signs the change with a real minus sign', () => {
    expect(formatCountDelta(2, 'can')).toBe('+2 cans');
    expect(formatCountDelta(-1, 'can')).toBe('−1 can');
    expect(formatCountDelta(-0.5, 'bag')).toBe('−0.5 bags');
  });
});

describe('defaultContainer', () => {
  it('picks cans for wet food and pate, bags for dry food and treats', () => {
    expect(defaultContainer('wet')).toBe('can');
    expect(defaultContainer('pate')).toBe('can');
    expect(defaultContainer('dry')).toBe('bag');
    expect(defaultContainer('treat')).toBe('bag');
    expect(defaultContainer('supplement')).toBe('bottle');
    expect(defaultContainer('other')).toBe('item');
  });

  it('covers every category', () => {
    for (const category of CATEGORIES) {
      expect(CONTAINERS).toContain(defaultContainer(category));
    }
  });
});
