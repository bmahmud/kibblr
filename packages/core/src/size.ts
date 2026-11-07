import { baseUnitOf, toBase } from './units';
import type { DisplayUnit, Size } from './units';

/** Unit spellings seen on labels and in product databases, longest first so "fl oz" wins over "oz". */
const UNIT_WORDS: readonly [RegExp, DisplayUnit | 'l'][] = [
  [/^fl\.?\s*oz\.?/, 'floz'],
  [/^(lbs?|pounds?)\b\.?/, 'lb'],
  [/^(oz|ounces?)\b\.?/, 'oz'],
  [/^(kg|kilograms?)\b/, 'kg'],
  [/^(g|grams?)\b/, 'g'],
  [/^(ml|millilit(re|er)s?)\b/, 'ml'],
  [/^(l|lit(re|er)s?)\b/, 'l'],
];

const NUMBER = /(\d+(?:[.,]\d+)?)\s*/g;

/**
 * A package size from free text, e.g. "3 oz", "12 lb", "3 oz (85 g)" or
 * "12 fl oz" (spec section 7.2). The first number followed by a known unit
 * wins. Null when there is none.
 */
export function parseSizeText(text: string): Size | null {
  const lower = text.toLowerCase();
  for (const match of lower.matchAll(NUMBER)) {
    const value = Number(match[1]?.replace(',', '.'));
    const rest = lower.slice((match.index ?? 0) + match[0].length);
    for (const [pattern, unit] of UNIT_WORDS) {
      if (!pattern.test(rest)) {
        continue;
      }
      const amount = unit === 'l' ? toBase(value * 1000, 'ml') : toBase(value, unit);
      if (amount <= 0) {
        return null;
      }
      return { amount, unit: unit === 'l' ? 'ml' : baseUnitOf(unit) };
    }
  }
  return null;
}
