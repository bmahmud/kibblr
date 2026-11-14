import { describe, expect, it } from 'vitest';

import { DEFAULT_HOUSEHOLD_SETTINGS } from './household';
import { shoppingList, shoppingListText } from './shopping';
import type { ShoppingProduct } from './shopping';

const settings = DEFAULT_HOUSEHOLD_SETTINGS; // 7 low-stock days

function product(overrides: Partial<ShoppingProduct> & { id: string }): ShoppingProduct & { id: string } {
  return {
    name: 'Salmon Feast',
    brand: 'Fancy Feast',
    category: 'pate',
    container: 'can',
    size: null,
    onHand: 0,
    dailyUsage: null,
    lowStock: null,
    petIds: [],
    verdict: 'undecided',
    archived: false,
    ...overrides,
  };
}

describe('shoppingList', () => {
  it('lists only low or out products, and puts skips aside', () => {
    const list = shoppingList(
      [
        product({ id: 'out' }),
        product({ id: 'plenty', onHand: 12 }),
        product({ id: 'skip', verdict: 'skip' }),
        product({ id: 'archived', archived: true }),
        product({ id: 'reorder', verdict: 'reorder', onHand: 1 }),
      ],
      settings,
    );
    expect(list.toBuy.map((i) => i.product.id)).toEqual(['out', 'reorder']);
    expect(list.notReordering.map((i) => i.product.id)).toEqual(['skip']);
    expect(list.toBuy[1]).toMatchObject({ status: 'low', runway: null });
  });

  it('sorts out first, then by shortest runway, then unknown runway, then name', () => {
    const list = shoppingList(
      [
        product({ id: 'unknown-b', name: 'B', onHand: 1 }),
        product({ id: 'unknown-a', name: 'A', onHand: 1 }),
        product({ id: 'five-days', onHand: 5, dailyUsage: 1 }),
        product({ id: 'two-days', onHand: 1, dailyUsage: 0.5 }),
        product({ id: 'out-z', name: 'Z' }),
        product({ id: 'out-a', name: 'a' }),
      ],
      settings,
    );
    expect(list.toBuy.map((i) => i.product.id)).toEqual([
      'out-a',
      'out-z',
      'two-days',
      'five-days',
      'unknown-a',
      'unknown-b',
    ]);
  });
});

describe('shoppingListText', () => {
  it('writes one line per product with its size and what is left', () => {
    const list = shoppingList(
      [
        product({ id: '1', size: { amount: 85, unit: 'g' } }),
        product({ id: '2', name: 'Indoor Kibble', brand: '', category: 'dry', container: 'bag', onHand: 0.5 }),
      ],
      settings,
    );
    expect(shoppingListText(list.toBuy, 'lb')).toBe(
      [
        'Kibblr shopping list',
        '• Fancy Feast Salmon Feast · 3 oz can (out)',
        '• Indoor Kibble · bag (0.5 bags left)',
      ].join('\n'),
    );
  });
});
