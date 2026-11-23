import { describe, expect, it } from 'vitest';

import { DEFAULT_HOUSEHOLD_SETTINGS } from './household';
import { formatRunway, groupInventory, runwayDays, stockStatus, stockTotals } from './inventory';
import type { InventoryProduct, StockTotalsProduct } from './inventory';

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
    petIds: [],
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

  it('filters by pet', () => {
    const eaten = [
      product({ id: 'miso', petIds: ['miso'] }),
      product({ id: 'both', petIds: ['miso', 'biscuit'] }),
      product({ id: 'nobody' }),
    ];
    const { ok } = groupInventory(eaten, settings, { petId: 'biscuit' });
    expect(ok.map((i) => i.product.id)).toEqual(['both']);
    expect(groupInventory(eaten, settings, { petId: null }).ok).toHaveLength(3);
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

describe('learned rates', () => {
  it('give a runway when no daily usage is set', () => {
    expect(runwayDays(product({ onHand: 9 }), 0.5)).toBe(18);
    expect(runwayDays(product({ onHand: 9, dailyUsage: 1 }), 0.5)).toBe(9);
    expect(runwayDays(product({ onHand: 9 }), null)).toBeNull();
  });

  it('decide days-mode status instead of the last-package rule', () => {
    expect(stockStatus(product({ onHand: 3 }), settings, 1)).toBe('low');
    expect(stockStatus(product({ onHand: 1 }), settings, 0.1)).toBe('ok');
  });

  it('are looked up per product when grouping', () => {
    const rates = new Map([['a', 1]]);
    const { lowOrOut, ok } = groupInventory(
      [product({ id: 'a', name: 'A', onHand: 3 }), product({ id: 'b', name: 'B', onHand: 3 })],
      settings,
      {},
      (p) => rates.get(p.id) ?? null,
    );
    expect(lowOrOut.map((i) => i.product.id)).toEqual(['a']);
    expect(ok.map((i) => i.product.id)).toEqual(['b']);
  });
});

describe('formatRunway', () => {
  it('rounds down to whole days', () => {
    expect(formatRunway(9.8)).toBe('~9 days');
    expect(formatRunway(1.5)).toBe('~1 day');
    expect(formatRunway(0.4)).toBe('<1 day');
    expect(formatRunway(0)).toBe('<1 day');
  });
});

describe('stockTotals', () => {
  const item = (container: StockTotalsProduct['container'], onHand: number, size: StockTotalsProduct['size'] = null) => ({
    container,
    onHand,
    size,
  });

  it('adds packages up by container, most first, skipping empty ones', () => {
    const totals = stockTotals([item('can', 12), item('bag', 2), item('can', 6.5), item('box', 0)]);
    expect(totals.containers).toEqual([
      { container: 'can', count: 18.5 },
      { container: 'bag', count: 2 },
    ]);
  });

  it('breaks ties in the usual container order', () => {
    expect(stockTotals([item('bag', 3), item('can', 3)]).containers.map((c) => c.container)).toEqual(['can', 'bag']);
  });

  it('adds weight and volume from package sizes, only for products that have one', () => {
    const totals = stockTotals([
      item('can', 12, { amount: 85, unit: 'g' }),
      item('bag', 1.5, { amount: 7257, unit: 'g' }),
      item('bottle', 2, { amount: 250, unit: 'ml' }),
      item('box', 4),
    ]);
    expect(totals.weight).toEqual({ amount: 12 * 85 + 1.5 * 7257, unit: 'g' });
    expect(totals.volume).toEqual({ amount: 500, unit: 'ml' });
    expect(totals.unsized).toBe(1);
  });

  it('has no weight or volume when nothing in stock has a size', () => {
    const totals = stockTotals([item('can', 3), item('can', 0, { amount: 85, unit: 'g' })]);
    expect(totals.weight).toBeNull();
    expect(totals.volume).toBeNull();
    expect(totals.unsized).toBe(1);
  });

  it('is empty for no stock', () => {
    expect(stockTotals([])).toEqual({ containers: [], weight: null, volume: null, unsized: 0 });
  });
});
