import type { Container } from './schemas';

/** The same code is ignored for this long after it is handled (spec section 6.3). */
export const SCAN_DEBOUNCE_MS = 2000;

export type LastScan = { code: string; at: number };

/** Whether a scan should be handled: always for a new code, and for a repeat once the window has passed. */
export function shouldHandleScan(last: LastScan | null, code: string, now: number): boolean {
  return last === null || last.code !== code || now - last.at >= SCAN_DEBOUNCE_MS;
}

/** A custom scan multiplier: a whole number from 1 to 99, or null. */
export function parseMultiplier(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return value >= 1 ? value : null;
}

/**
 * What a Use-mode scan does. Cans and pouches are used whole, so one comes
 * off straight away; bags and tubs are used a bit at a time, so it asks.
 */
export function scanUseAction(container: Container): 'remove-one' | 'ask' {
  switch (container) {
    case 'bag':
    case 'box':
    case 'tub':
    case 'bottle':
      return 'ask';
    case 'can':
    case 'pouch':
    case 'tray':
    case 'item':
      return 'remove-one';
  }
}

/** The quick-use choices, in packages. */
export const QUICK_USE = [0.25, 0.5, 1] as const;
