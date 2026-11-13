import { CONTAINER_LABELS, formatCount } from './count';
import { runwayDays, stockStatus } from './inventory';
import type { InventoryProduct } from './inventory';
import type { HouseholdSettings, Product } from './schemas';
import { formatSize } from './units';

/** The product fields the Shopping tab needs. */
export type ShoppingProduct = InventoryProduct & Pick<Product, 'container' | 'size' | 'verdict'>;

export type ShoppingItem<T> = { product: T; status: 'low' | 'out'; runway: number | null };

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** Out first, then the shortest runway, then unknown runway; ties by name. */
function byUrgency<T extends ShoppingProduct>(a: ShoppingItem<T>, b: ShoppingItem<T>): number {
  const rank = (item: ShoppingItem<T>) => (item.status === 'out' ? 0 : item.runway === null ? 2 : 1);
  return (
    rank(a) - rank(b) ||
    (a.runway !== null && b.runway !== null ? a.runway - b.runway : 0) ||
    byName(a.product, b.product)
  );
}

/**
 * The Shopping tab (spec section 6.6): low and out products to buy, most
 * urgent first, and the ones marked skip set aside so a replacement isn't forgotten.
 */
export function shoppingList<T extends ShoppingProduct>(
  products: readonly T[],
  settings: Pick<HouseholdSettings, 'defaultLowStockDays'>,
): { toBuy: ShoppingItem<T>[]; notReordering: ShoppingItem<T>[] } {
  const items: ShoppingItem<T>[] = [];
  for (const product of products) {
    if (product.archived) {
      continue;
    }
    const status = stockStatus(product, settings);
    if (status !== 'ok') {
      items.push({ product, status, runway: runwayDays(product) });
    }
  }
  items.sort(byUrgency);
  return {
    toBuy: items.filter((item) => item.product.verdict !== 'skip'),
    notReordering: items.filter((item) => item.product.verdict === 'skip'),
  };
}

/** The list as text for the share sheet: "• Fancy Feast Salmon Feast · 3 oz can (out)". */
export function shoppingListText(items: readonly ShoppingItem<ShoppingProduct>[], preferred: 'lb' | 'kg'): string {
  const lines = items.map(({ product, status }) => {
    const name = [product.brand, product.name].filter(Boolean).join(' ');
    const label = CONTAINER_LABELS[product.container].one;
    const pack = product.size ? `${formatSize(product.size, preferred)} ${label}` : label;
    const left = status === 'out' ? 'out' : `${formatCount(product.onHand, product.container)} left`;
    return `• ${name} · ${pack} (${left})`;
  });
  return ['Kibblr shopping list', ...lines].join('\n');
}
