import { formatAmount } from '@kibblr/core';
import type { BaseUnit, StockChange, WeightUnit } from '@kibblr/core';

type ProductLike = { name: string; baseUnit: BaseUnit };

/** The toast text after a stock change (spec sections 5.3 and 6.10). */
export function stockChangeMessage(change: StockChange, product: ProductLike, unit: WeightUnit): string {
  const amount = (value: number) => formatAmount(value, product.baseUnit, unit);

  switch (change.type) {
    case null:
      return change.clamped ? `${product.name} has nothing on hand.` : `${product.name} is unchanged.`;
    case 'add':
      return `Added ${amount(change.applied)} of ${product.name}.`;
    case 'adjust':
      return `${product.name} set to ${amount(change.after)}.`;
    case 'remove':
      return change.clamped
        ? `Only ${amount(change.before)} was on hand. ${product.name} is now empty.`
        : `Used ${amount(-change.applied)} of ${product.name}.`;
  }
}
