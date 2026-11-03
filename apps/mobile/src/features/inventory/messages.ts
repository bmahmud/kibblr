import { formatCount } from '@kibblr/core';
import type { Container, StockChange } from '@kibblr/core';

type ProductLike = { name: string; container: Container };

/** The toast text after a stock change (spec sections 5.3 and 6.10). */
export function stockChangeMessage(change: StockChange, product: ProductLike): string {
  const count = (value: number) => formatCount(value, product.container);

  switch (change.type) {
    case null:
      return change.clamped ? `${product.name} has nothing on hand.` : `${product.name} is unchanged.`;
    case 'add':
      return `Added ${count(change.applied)} of ${product.name}.`;
    case 'adjust':
      return `${product.name} set to ${count(change.after)}.`;
    case 'remove':
      return change.clamped
        ? `Only ${count(change.before)} ${change.before === 1 ? 'was' : 'were'} on hand. ${product.name} is now empty.`
        : `Used ${count(-change.applied)} of ${product.name}.`;
  }
}
