import { effectiveRate } from './prediction';
import type { Category, HouseholdSettings, Product } from './schemas';

/** The product fields stock status and the Inventory list need. */
export type InventoryProduct = Pick<
  Product,
  'name' | 'brand' | 'category' | 'onHand' | 'dailyUsage' | 'lowStock' | 'petIds' | 'archived'
>;

export type StockStatus = 'out' | 'low' | 'ok';

/**
 * Days until empty, or null when the rate is unknown (spec section 8): the
 * daily usage I set, else the rate learned from my use.
 */
export function runwayDays(product: Pick<Product, 'onHand' | 'dailyUsage'>, learned?: number | null): number | null {
  const rate = effectiveRate(product, learned);
  return rate ? product.onHand / rate : null;
}

/** "~9 days", "~1 day", or "<1 day" when it runs out today. */
export function formatRunway(days: number): string {
  const whole = Math.floor(days);
  return whole < 1 ? '<1 day' : `~${String(whole)} ${whole === 1 ? 'day' : 'days'}`;
}

/** A product's learned rate, or null; the screens pass one built from `learnedRates`. */
export type LearnedRateOf<T> = (product: T) => number | null;

/** Out at zero; low per the product's rule, or the household default (spec section 8 `isLow`). */
export function stockStatus(
  product: Pick<Product, 'onHand' | 'dailyUsage' | 'lowStock'>,
  settings: Pick<HouseholdSettings, 'defaultLowStockDays'>,
  learned?: number | null,
): StockStatus {
  if (product.onHand === 0) {
    return 'out';
  }
  const rule = product.lowStock ?? { mode: 'days', value: settings.defaultLowStockDays };
  if (rule.mode === 'amount') {
    return product.onHand <= rule.value ? 'low' : 'ok';
  }
  const runway = runwayDays(product, learned);
  // Without a usage rate, the last package is low.
  const low = runway === null ? product.onHand <= 1 : runway <= rule.value;
  return low ? 'low' : 'ok';
}

export type InventoryItem<T> = { product: T; status: StockStatus };

export type InventoryFilter = {
  query?: string;
  category?: Category | null;
  /** Only products this pet eats. */
  petId?: string | null;
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * The Inventory list (spec section 6.2): non-archived products matching the
 * search, category and pet, split into Low / Out (out first) and OK, by name.
 */
export function groupInventory<T extends InventoryProduct>(
  products: readonly T[],
  settings: Pick<HouseholdSettings, 'defaultLowStockDays'>,
  filter: InventoryFilter = {},
  learned?: LearnedRateOf<T>,
): { lowOrOut: InventoryItem<T>[]; ok: InventoryItem<T>[] } {
  const query = filter.query?.trim().toLowerCase() ?? '';
  const items = products
    .filter((p) => !p.archived)
    .filter((p) => !filter.category || p.category === filter.category)
    .filter((p) => !filter.petId || p.petIds.includes(filter.petId))
    .filter((p) => !query || p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query))
    .map((product) => ({ product, status: stockStatus(product, settings, learned?.(product)) }))
    .sort((a, b) => byName(a.product, b.product));

  return {
    lowOrOut: [...items.filter((i) => i.status === 'out'), ...items.filter((i) => i.status === 'low')],
    ok: items.filter((i) => i.status === 'ok'),
  };
}
