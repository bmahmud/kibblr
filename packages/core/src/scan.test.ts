import { describe, expect, it } from 'vitest';

import { CONTAINERS } from './schemas';
import { QUICK_USE, SCAN_DEBOUNCE_MS, parseMultiplier, shouldHandleScan, scanUseAction } from './scan';

describe('shouldHandleScan', () => {
  const at = 1_000_000;

  it('handles the first scan', () => {
    expect(shouldHandleScan(null, '4006381333931', at)).toBe(true);
  });

  it('ignores the same code within the debounce window', () => {
    const last = { code: '4006381333931', at };
    expect(shouldHandleScan(last, '4006381333931', at + 500)).toBe(false);
    expect(shouldHandleScan(last, '4006381333931', at + SCAN_DEBOUNCE_MS - 1)).toBe(false);
  });

  it('handles the same code again once the window has passed', () => {
    expect(shouldHandleScan({ code: '4006381333931', at }, '4006381333931', at + SCAN_DEBOUNCE_MS)).toBe(true);
  });

  it('handles a different code straight away', () => {
    expect(shouldHandleScan({ code: '4006381333931', at }, '0036000291452', at + 10)).toBe(true);
  });

  it('uses a two-second window', () => {
    expect(SCAN_DEBOUNCE_MS).toBe(2000);
  });
});

describe('parseMultiplier', () => {
  it('accepts whole numbers from 1 to 99', () => {
    expect(parseMultiplier('1')).toBe(1);
    expect(parseMultiplier(' 24 ')).toBe(24);
    expect(parseMultiplier('99')).toBe(99);
  });

  it('rejects zero, fractions, out-of-range and non-numbers', () => {
    for (const text of ['0', '1.5', '100', '-2', '', 'twelve']) {
      expect(parseMultiplier(text)).toBeNull();
    }
  });
});

describe('scanUseAction', () => {
  it('removes one straight away for single-serve containers', () => {
    for (const container of ['can', 'pouch', 'tray', 'item'] as const) {
      expect(scanUseAction(container)).toBe('remove-one');
    }
  });

  it('asks how much for containers that are used a bit at a time', () => {
    for (const container of ['bag', 'box', 'tub', 'bottle'] as const) {
      expect(scanUseAction(container)).toBe('ask');
    }
  });

  it('covers every container', () => {
    for (const container of CONTAINERS) {
      expect(['remove-one', 'ask']).toContain(scanUseAction(container));
    }
  });
});

describe('QUICK_USE', () => {
  it('offers a quarter, a half and a whole package', () => {
    expect(QUICK_USE).toEqual([0.25, 0.5, 1]);
  });
});
