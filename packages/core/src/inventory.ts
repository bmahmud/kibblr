import type { Category, HouseholdSettings, Product } from './schemas';

/** The product fields stock status and the Inventory list need. */
export type InventoryProduct = Pick<
  Product,
  'name' | 'brand' | 'category' | 'onHand' | 'dailyUsage' | 'lowStock' | 'archived'
>;

export type StockStatus = 'out' | 'low' | 'ok';

/**
 * Days until empty, or null when the rate is unknown (spec section 8). Uses
 * `dailyUsage` only for now; the learned rate joins in a later phase.
 */
export function runwayDays(product: Pick<Product, 'onHand' | 'dailyUsage'>): number | null {
  return product.dailyUsage ? product.onHand / product.dailyUsage : null;
}

/** Out at zero; low per the product's rule, or the household default (spec section 8 `isLow`). */
export function stockStatus(
  product: Pick<Product, 'onHand' | 'dailyUsage' | 'lowStock'>,
  settings: Pick<HouseholdSettings, 'defaultLowStockDays'>,
): StockStatus {
  if (product.onHand === 0) {
    return 'out';
  }
  const rule = product.lowStock ?? { mode: 'days', value: settings.defaultLowStockDays };
  if (rule.mode === 'amount') {
    return product.onHand <= rule.value ? 'low' : 'ok';
  }
  const runway = runwayDays(product);
  // Without a usage rate, the last package is low.
  const low = runway === null ? product.onHand <= 1 : runway <= rule.value;
  return low ? 'low' : 'ok';
}

export type InventoryItem<T> = { product: T; status: StockStatus };

export type InventoryFilter = {
  query?: string;
  category?: Category | null;
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * The Inventory list (spec section 6.2): non-archived products matching the
 * search and category, split into Low / Out (out first) and OK, by name.
 */
export function groupInventory<T extends InventoryProduct>(
  products: readonly T[],
  settings: Pick<HouseholdSettings, 'defaultLowStockDays'>,
  filter: InventoryFilter = {},
): { lowOrOut: InventoryItem<T>[]; ok: InventoryItem<T>[] } {
  const query = filter.query?.trim().toLowerCase() ?? '';
  const items = products
    .filter((p) => !p.archived)
    .filter((p) => !filter.category || p.category === filter.category)
    .filter((p) => !query || p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query))
    .map((product) => ({ product, status: stockStatus(product, settings) }))
    .sort((a, b) => byName(a.product, b.product));

  return {
    lowOrOut: [...items.filter((i) => i.status === 'out'), ...items.filter((i) => i.status === 'low')],
    ok: items.filter((i) => i.status === 'ok'),
  };
}
