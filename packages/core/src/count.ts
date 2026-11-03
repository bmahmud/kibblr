import type { Category, Container } from './schemas';

/**
 * Stock is counted in packages (spec section 5.1 `onHand`): cans, bags,
 * pouches. Fractions are allowed ("1.5 bags") and kept to hundredths.
 */
export const CONTAINER_LABELS: Record<Container, { one: string; many: string }> = {
  can: { one: 'can', many: 'cans' },
  pouch: { one: 'pouch', many: 'pouches' },
  tray: { one: 'tray', many: 'trays' },
  bag: { one: 'bag', many: 'bags' },
  box: { one: 'box', many: 'boxes' },
  tub: { one: 'tub', many: 'tubs' },
  bottle: { one: 'bottle', many: 'bottles' },
  item: { one: 'item', many: 'items' },
};

/** Rounds a package count to what is stored, so float drift never accumulates in `onHand`. */
export function roundCount(count: number): number {
  // `+ 0` turns -0 into 0.
  return Math.round(count * 100) / 100 + 0;
}

/** "1 can", "12 cans", "1.5 bags", "0 boxes". */
export function formatCount(count: number, container: Container): string {
  const rounded = roundCount(count);
  const label = CONTAINER_LABELS[container];
  return `${String(rounded)} ${rounded === 1 ? label.one : label.many}`;
}

/** Signed change, e.g. "+2 cans" or "−1 can" (with a real minus sign). */
export function formatCountDelta(delta: number, container: Container): string {
  return `${delta < 0 ? '−' : '+'}${formatCount(Math.abs(delta), container)}`;
}

/** The container a new product starts on, from its type. */
export function defaultContainer(category: Category): Container {
  switch (category) {
    case 'wet':
    case 'pate':
      return 'can';
    case 'dry':
    case 'treat':
      return 'bag';
    case 'supplement':
      return 'bottle';
    case 'other':
      return 'item';
  }
}
