/**
 * Base units (spec section 4). All stock math is done in these; the UI converts
 * to lb/oz/cups for display and input. Conversion helpers arrive in Phase 2.
 */
export const BASE_UNITS = ['g', 'ml', 'count'] as const;

export type BaseUnit = (typeof BASE_UNITS)[number];

export function isBaseUnit(value: unknown): value is BaseUnit {
  return typeof value === 'string' && (BASE_UNITS as readonly string[]).includes(value);
}
