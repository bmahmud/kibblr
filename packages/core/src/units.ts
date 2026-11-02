/**
 * Base units (spec section 4). All stock math is done in these; the UI converts
 * to lb/oz/cups for display and input.
 */
export const BASE_UNITS = ['g', 'ml', 'count'] as const;

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
  count: ['count'],
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
  count: 'ct',
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
  count: { base: 'count', factor: 1 },
};

export function baseUnitOf(unit: DisplayUnit): BaseUnit {
  return UNITS[unit].base;
}

/**
 * Rounds an amount to what is stored: whole grams and millilitres, hundredths
 * of a count (a quarter can). Applied wherever an amount enters storage, so
 * float drift never accumulates in `onHand`.
 */
export function roundBase(amount: number, baseUnit: BaseUnit): number {
  const step = baseUnit === 'count' ? 100 : 1;
  // `+ 0` turns -0 into 0.
  return Math.round(amount * step) / step + 0;
}

function assertAmount(value: number, what: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${what} must be a finite number, 0 or more (got ${value})`);
  }
}

/** Display-unit value to a stored base amount. */
export function toBase(value: number, unit: DisplayUnit): number {
  assertAmount(value, 'Amount');
  const { base, factor } = UNITS[unit];
  return roundBase(value * factor, base);
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

function displayUnitFor(amount: number, baseUnit: BaseUnit, preferred: 'lb' | 'kg'): DisplayUnit {
  switch (baseUnit) {
    case 'g':
      if (preferred === 'lb') {
        return amount === 0 || amount >= UNITS.lb.factor ? 'lb' : 'oz';
      }
      return amount === 0 || amount >= 1000 ? 'kg' : 'g';
    case 'ml':
      return preferred === 'lb' ? 'floz' : 'ml';
    case 'count':
      return 'count';
  }
}

/** Friendly on-hand text, e.g. "7.2 lb", "5.3 oz", "850 g", "3 ct". */
export function formatAmount(amount: number, baseUnit: BaseUnit, preferred: 'lb' | 'kg'): string {
  const unit = displayUnitFor(Math.abs(amount), baseUnit, preferred);
  return `${formatNumber(fromBase(amount, unit))} ${UNIT_LABELS[unit]}`;
}

/** Signed change, e.g. "+12 lb" or "−5.3 oz" (with a real minus sign). */
export function formatDelta(delta: number, baseUnit: BaseUnit, preferred: 'lb' | 'kg'): string {
  return `${delta < 0 ? '−' : '+'}${formatAmount(Math.abs(delta), baseUnit, preferred)}`;
}

/** The unit an amount field starts on (spec open question 3: lb / oz households). */
export function defaultInputUnit(baseUnit: BaseUnit, preferred: 'lb' | 'kg'): DisplayUnit {
  switch (baseUnit) {
    case 'g':
      return preferred;
    case 'ml':
      return preferred === 'lb' ? 'floz' : 'ml';
    case 'count':
      return 'count';
  }
}
