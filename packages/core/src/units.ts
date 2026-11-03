import type { Container } from './schemas';

/**
 * Base units for a package's size (spec section 5.1 `size`). Stock itself is
 * counted in packages (see `count.ts`); sizes are stored in these and shown in
 * lb/oz/fl oz or kg/g/ml.
 */
export const BASE_UNITS = ['g', 'ml'] as const;

export type BaseUnit = (typeof BASE_UNITS)[number];

export function isBaseUnit(value: unknown): value is BaseUnit {
  return typeof value === 'string' && (BASE_UNITS as readonly string[]).includes(value);
}

/**
 * Units offered for input and display, per base unit. Cups are volume only:
 * grams per cup of kibble varies by food, so dry food is entered by weight.
 */
export const DISPLAY_UNITS = {
  g: ['lb', 'oz', 'kg', 'g'],
  ml: ['floz', 'cup', 'ml'],
} as const satisfies Record<BaseUnit, readonly string[]>;

export type DisplayUnit = (typeof DISPLAY_UNITS)[BaseUnit][number];

export const UNIT_LABELS: Record<DisplayUnit, string> = {
  lb: 'lb',
  oz: 'oz',
  kg: 'kg',
  g: 'g',
  floz: 'fl oz',
  cup: 'cup',
  ml: 'ml',
};

/** Base units per one display unit. */
const UNITS: Record<DisplayUnit, { base: BaseUnit; factor: number }> = {
  lb: { base: 'g', factor: 453.59237 },
  oz: { base: 'g', factor: 28.349523125 },
  kg: { base: 'g', factor: 1000 },
  g: { base: 'g', factor: 1 },
  floz: { base: 'ml', factor: 29.5735295625 },
  cup: { base: 'ml', factor: 236.5882365 },
  ml: { base: 'ml', factor: 1 },
};

export function baseUnitOf(unit: DisplayUnit): BaseUnit {
  return UNITS[unit].base;
}

/** Rounds a size to what is stored: whole grams and millilitres. */
export function roundBase(amount: number): number {
  // `+ 0` turns -0 into 0.
  return Math.round(amount) + 0;
}

function assertAmount(value: number, what: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${what} must be a finite number, 0 or more (got ${value})`);
  }
}

/** Display-unit value to a stored base amount. */
export function toBase(value: number, unit: DisplayUnit): number {
  assertAmount(value, 'Amount');
  return roundBase(value * UNITS[unit].factor);
}

/** Base amount to a display-unit value, unrounded. */
export function fromBase(amount: number, unit: DisplayUnit): number {
  return amount / UNITS[unit].factor;
}

/** Parses typed input like "12", "1.5" or "1,5". Null unless it is a plain non-negative number. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

/** One decimal at most, no trailing ".0". */
export function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10 + 0);
}

/** A package's net weight or volume, e.g. 85 g for a 3 oz can. */
export type Size = { amount: number; unit: BaseUnit };

/** The unit a size reads best in: oz under a pound (g under a kilogram), fl oz or ml for volume. */
export function sizeDisplayUnit(size: Size, preferred: 'lb' | 'kg'): DisplayUnit {
  if (size.unit === 'ml') {
    return preferred === 'lb' ? 'floz' : 'ml';
  }
  if (preferred === 'lb') {
    return size.amount >= UNITS.lb.factor ? 'lb' : 'oz';
  }
  return size.amount >= 1000 ? 'kg' : 'g';
}

/** Friendly size text, e.g. "3 oz", "16 lb", "12 fl oz", "850 g". */
export function formatSize(size: Size, preferred: 'lb' | 'kg'): string {
  const unit = sizeDisplayUnit(size, preferred);
  return `${formatNumber(fromBase(size.amount, unit))} ${UNIT_LABELS[unit]}`;
}

/** The unit the size field starts on: bags and boxes by the pound or kilo, bottles by volume, the rest by oz or g. */
export function defaultSizeUnit(container: Container, preferred: 'lb' | 'kg'): DisplayUnit {
  switch (container) {
    case 'bag':
    case 'box':
      return preferred;
    case 'bottle':
      return preferred === 'lb' ? 'floz' : 'ml';
    default:
      return preferred === 'lb' ? 'oz' : 'g';
  }
}
