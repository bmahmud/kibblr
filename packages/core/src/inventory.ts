import { roundCount } from './count';
import { effectiveRate } from './prediction';
import { CONTAINERS } from './schemas';
import type { Category, Container, HouseholdSettings, Product } from './schemas';
import type { Size } from './units';

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

/** The product fields the stock totals need. */
export type StockTotalsProduct = Pick<Product, 'container' | 'onHand' | 'size'>;

export type StockTotals = {
  /** Packages on hand per container, most first; containers with none are left out. */
  containers: { container: Container; count: number }[];
  /** Net weight on hand, from products with a size in grams; null when none has one. */
  weight: Size | null;
  /** Same for volume (bottles). */
  volume: Size | null;
  /** In-stock products without a size, so the weight is "at least". */
  unsized: number;
};

/**
 * What is on hand altogether (the Inventory summary): packages by container,
 * since cans and bags don't add up, plus total weight and volume where
 * package sizes are known.
 */
export function stockTotals(products: readonly StockTotalsProduct[]): StockTotals {
  const counts = new Map<Container, number>();
  let grams = 0;
  let millilitres = 0;
  let unsized = 0;
  for (const product of products) {
    if (product.onHand <= 0) {
      continue;
    }
    counts.set(product.container, (counts.get(product.container) ?? 0) + product.onHand);
    if (!product.size) {
      unsized += 1;
    } else if (product.size.unit === 'g') {
      grams += product.onHand * product.size.amount;
    } else {
      millilitres += product.onHand * product.size.amount;
    }
  }
  const containers = CONTAINERS.filter((container) => counts.has(container))
    .map((container) => ({ container, count: roundCount(counts.get(container) ?? 0) }))
    // Stable sort: ties keep the CONTAINERS order.
    .sort((a, b) => b.count - a.count);
  return {
    containers,
    weight: grams > 0 ? { amount: grams, unit: 'g' } : null,
    volume: millilitres > 0 ? { amount: millilitres, unit: 'ml' } : null,
    unsized,
  };
}
