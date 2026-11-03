import { describe, expect, it } from 'vitest';

import { DEFAULT_HOUSEHOLD_SETTINGS } from './household';
import { groupInventory, runwayDays, stockStatus } from './inventory';
import type { InventoryProduct } from './inventory';

const settings = DEFAULT_HOUSEHOLD_SETTINGS; // 7 low-stock days

function product(overrides: Partial<InventoryProduct> & { id?: string } = {}): InventoryProduct & { id: string } {
  return {
    id: 'p1',
    name: 'Chicken Kibble',
    brand: 'Acme',
    category: 'dry',
    onHand: 4,
    dailyUsage: null,
    lowStock: null,
    archived: false,
    ...overrides,
  };
}

describe('runwayDays', () => {
  it('is null without a daily usage', () => {
    expect(runwayDays(product())).toBeNull();
  });

  it('divides on hand by daily usage', () => {
    expect(runwayDays(product({ onHand: 9, dailyUsage: 1 }))).toBe(9);
  });

  it('is zero when out', () => {
    expect(runwayDays(product({ onHand: 0, dailyUsage: 1 }))).toBe(0);
  });
});

describe('stockStatus', () => {
  it('is out at exactly zero, whatever the rule', () => {
    expect(stockStatus(product({ onHand: 0 }), settings)).toBe('out');
    expect(stockStatus(product({ onHand: 0, lowStock: { mode: 'amount', value: 1 } }), settings)).toBe('out');
  });

  describe('days mode (household default)', () => {
    it('falls back to the last package when there is no runway', () => {
      expect(stockStatus(product({ onHand: 1 }), settings)).toBe('low');
      expect(stockStatus(product({ onHand: 0.5 }), settings)).toBe('low');
      expect(stockStatus(product({ onHand: 1.01 }), settings)).toBe('ok');
    });

    it('uses runway against the household default days when daily usage is known', () => {
      expect(stockStatus(product({ onHand: 14, dailyUsage: 2 }), settings)).toBe('low'); // 7 days
      expect(stockStatus(product({ onHand: 16, dailyUsage: 2 }), settings)).toBe('ok'); // 8 days
    });

    it("uses the product's own day count over the household default", () => {
      const p = product({ onHand: 16, dailyUsage: 2, lowStock: { mode: 'days', value: 10 } });
      expect(stockStatus(p, settings)).toBe('low');
    });
  });

  describe('amount mode', () => {
    it('is low at or below the amount', () => {
      const rule = { mode: 'amount', value: 3 } as const;
      expect(stockStatus(product({ onHand: 3, lowStock: rule }), settings)).toBe('low');
      expect(stockStatus(product({ onHand: 4, lowStock: rule }), settings)).toBe('ok');
    });
  });
});

describe('groupInventory', () => {
  const items = [
    product({ id: 'ok-b', name: 'Beef Bites', onHand: 5 }),
    product({ id: 'low', name: 'Turkey Pate', onHand: 1, category: 'pate', brand: 'Purr' }),
    product({ id: 'out', name: 'Zesty Treats', onHand: 0, category: 'treat' }),
    product({ id: 'ok-a', name: 'apple crunch', onHand: 5, category: 'treat' }),
    product({ id: 'archived', name: 'Old Food', onHand: 0, archived: true }),
  ];

  it('splits low/out from ok, out first, then by name, skipping archived', () => {
    const { lowOrOut, ok } = groupInventory(items, settings);
    expect(lowOrOut.map((i) => i.product.id)).toEqual(['out', 'low']);
    expect(lowOrOut.map((i) => i.status)).toEqual(['out', 'low']);
    expect(ok.map((i) => i.product.id)).toEqual(['ok-a', 'ok-b']);
  });

  it('searches name and brand, case-insensitively and trimmed', () => {
    expect(groupInventory(items, settings, { query: '  purr ' }).lowOrOut.map((i) => i.product.id)).toEqual(['low']);
    const { lowOrOut, ok } = groupInventory(items, settings, { query: 'BEEF' });
    expect([...lowOrOut, ...ok].map((i) => i.product.id)).toEqual(['ok-b']);
  });

  it('filters by category', () => {
    const { lowOrOut, ok } = groupInventory(items, settings, { category: 'treat' });
    expect(lowOrOut.map((i) => i.product.id)).toEqual(['out']);
    expect(ok.map((i) => i.product.id)).toEqual(['ok-a']);
  });

  it('filters by the pate category', () => {
    const { lowOrOut, ok } = groupInventory(items, settings, { category: 'pate' });
    expect([...lowOrOut, ...ok].map((i) => i.product.id)).toEqual(['low']);
  });

  it('returns empty groups for no products', () => {
    expect(groupInventory([], settings)).toEqual({ lowOrOut: [], ok: [] });
  });
});
