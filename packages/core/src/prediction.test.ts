import { describe, expect, it } from 'vitest';

import { DEFAULT_HOUSEHOLD_SETTINGS } from './household';
import {
  ALERT_LIMIT,
  autoDeductBaseline,
  autoDeductPlan,
  effectiveRate,
  learnedRate,
  learnedRates,
  lowStockAlertAt,
  lowStockMessage,
  nextNotifyTime,
  planLowStockAlerts,
  usagePatch,
  validateUsageForm,
} from './prediction';
import type { AlertProduct, RateEvent } from './prediction';

// Local times, so the tests mean the same thing in every time zone.
const at = (day: number, hour = 12, minute = 0) => new Date(2026, 10, day, hour, minute);
const now = at(14, 12); // Sat Nov 14 2026, noon
const settings = DEFAULT_HOUSEHOLD_SETTINGS; // 7 days, 9 AM

function event(overrides: Partial<RateEvent> = {}): RateEvent {
  return {
    productId: 'p1',
    type: 'remove',
    method: 'manual',
    delta: -1,
    note: null,
    createdAt: at(1),
    ...overrides,
  };
}

function product(overrides: Partial<AlertProduct> = {}): AlertProduct {
  return {
    id: 'p1',
    name: 'Salmon Feast',
    onHand: 10,
    dailyUsage: 1,
    autoDeduct: false,
    lastAutoDeductAt: null,
    lowStock: null,
    verdict: 'undecided',
    archived: false,
    ...overrides,
  };
}

describe('learnedRate', () => {
  it('is null with no use', () => {
    expect(learnedRate([], now)).toBeNull();
  });

  it('divides use by the days since the first counted use', () => {
    // Nov 4 noon to Nov 14 noon: 10 days, 5 cans.
    const events = [event({ createdAt: at(4), delta: -2 }), event({ createdAt: at(10), delta: -3 })];
    expect(learnedRate(events, now)).toBeCloseTo(0.5);
  });

  it('needs at least 7 days of data', () => {
    expect(learnedRate([event({ createdAt: at(8) })], now)).toBeNull(); // 6 days
    expect(learnedRate([event({ createdAt: at(7) })], now)).toBeCloseTo(1 / 7);
  });

  it('only looks at the last 30 days', () => {
    const old = event({ createdAt: new Date(2026, 9, 10), delta: -100 });
    expect(learnedRate([old, event({ createdAt: at(4), delta: -10 })], now)).toBeCloseTo(1);
  });

  it('counts scan, manual and feeding but not auto, adds or adjusts', () => {
    const events = [
      event({ createdAt: at(4), method: 'scan', delta: -1 }),
      event({ createdAt: at(5), method: 'feeding', delta: -1 }),
      event({ createdAt: at(6), method: 'manual', delta: -1 }),
      event({ createdAt: at(1), method: 'auto', delta: -50 }),
      event({ createdAt: at(2), type: 'add', delta: 12 }),
      event({ createdAt: at(3), type: 'adjust', delta: -4 }),
    ];
    expect(learnedRate(events, now)).toBeCloseTo(3 / 10);
  });

  it('subtracts undone uses', () => {
    const events = [
      event({ createdAt: at(4), delta: -2 }),
      event({ createdAt: at(6), delta: -1 }),
      event({ createdAt: at(6, 13), type: 'add', delta: 1, note: 'undo' }),
    ];
    expect(learnedRate(events, now)).toBeCloseTo(2 / 10);
  });

  it('is null when every use was undone', () => {
    const events = [
      event({ createdAt: at(4), delta: -1 }),
      event({ createdAt: at(4, 13), type: 'add', delta: 1, note: 'undo' }),
    ];
    expect(learnedRate(events, now)).toBeNull();
  });
});

describe('learnedRates', () => {
  it('groups by product and leaves out unknown rates', () => {
    const rates = learnedRates(
      [
        event({ productId: 'a', createdAt: at(4), delta: -10 }),
        event({ productId: 'b', createdAt: at(12), delta: -1 }),
      ],
      now,
    );
    expect(rates.get('a')).toBeCloseTo(1);
    expect(rates.has('b')).toBe(false);
  });
});

describe('effectiveRate', () => {
  it('prefers the daily usage I set, then the learned rate', () => {
    expect(effectiveRate({ dailyUsage: 2 }, 0.5)).toBe(2);
    expect(effectiveRate({ dailyUsage: null }, 0.5)).toBe(0.5);
    expect(effectiveRate({ dailyUsage: null }, null)).toBeNull();
    expect(effectiveRate({ dailyUsage: null })).toBeNull();
  });
});

describe('autoDeductPlan', () => {
  const auto = (overrides: Partial<AlertProduct> = {}) =>
    product({ autoDeduct: true, dailyUsage: 0.5, lastAutoDeductAt: at(11, 0), ...overrides });

  it('does nothing unless auto-deduct is on with a daily usage', () => {
    expect(autoDeductPlan(product(), now)).toBeNull();
    expect(autoDeductPlan(auto({ dailyUsage: null }), now)).toBeNull();
  });

  it('deducts whole calendar days and moves the mark to the start of today', () => {
    expect(autoDeductPlan(auto(), now)).toEqual({ days: 3, delta: -1.5, nextAt: at(14, 0) });
  });

  it('counts a day at midnight, not after 24 hours', () => {
    expect(autoDeductPlan(auto({ lastAutoDeductAt: at(13, 0) }), at(14, 0, 1))).toEqual({
      days: 1,
      delta: -0.5,
      nextAt: at(14, 0),
    });
  });

  it('is idempotent within a day', () => {
    expect(autoDeductPlan(auto({ lastAutoDeductAt: at(14, 0) }), at(14, 23))).toBeNull();
  });

  it('sets a missing mark without deducting', () => {
    expect(autoDeductPlan(auto({ lastAutoDeductAt: null }), now)).toEqual({ days: 0, delta: 0, nextAt: at(14, 0) });
  });

  it('survives a daylight saving change', () => {
    // US clocks go back on Nov 1 2026; 25-hour days must still count as one.
    const plan = autoDeductPlan(auto({ lastAutoDeductAt: new Date(2026, 9, 31) }), new Date(2026, 10, 2, 8));
    expect(plan?.days).toBe(2);
  });

  it('rounds the delta to hundredths', () => {
    expect(autoDeductPlan(auto({ dailyUsage: 1 / 3 }), now)?.delta).toBe(-1);
    expect(autoDeductPlan(auto({ dailyUsage: 0.33, lastAutoDeductAt: at(13, 0) }), now)?.delta).toBe(-0.33);
  });
});

describe('autoDeductBaseline', () => {
  it('is the start of today', () => {
    expect(autoDeductBaseline(now)).toEqual(at(14, 0));
  });
});

describe('nextNotifyTime', () => {
  it('is today at the hour when it is still ahead, else tomorrow', () => {
    expect(nextNotifyTime(at(14, 8), 9)).toEqual(at(14, 9));
    expect(nextNotifyTime(at(14, 9), 9)).toEqual(at(15, 9));
    expect(nextNotifyTime(now, 9)).toEqual(at(15, 9));
  });
});

describe('lowStockAlertAt', () => {
  it('is null without a rate', () => {
    expect(lowStockAlertAt(product({ dailyUsage: null }), settings, null, now)).toBeNull();
  });

  it('is the run-out date minus the low-stock days, at the notify hour', () => {
    // 10 cans at 1 a day runs out Nov 24 noon; 7 days before is Nov 17.
    expect(lowStockAlertAt(product(), settings, 1, now)).toEqual({ at: at(17, 9), pastDue: false });
  });

  it("uses the product's own days rule", () => {
    const p = product({ lowStock: { mode: 'days', value: 2 } });
    expect(lowStockAlertAt(p, settings, 1, now)).toEqual({ at: at(22, 9), pastDue: false });
  });

  it('uses the date on hand reaches the amount rule', () => {
    const p = product({ lowStock: { mode: 'amount', value: 4 } });
    expect(lowStockAlertAt(p, settings, 2, now)).toEqual({ at: at(17, 9), pastDue: false });
  });

  it('uses the household notify hour', () => {
    expect(lowStockAlertAt(product(), { ...settings, notifyHour: 18 }, 1, now)?.at).toEqual(at(17, 18));
  });

  it('is the next notify hour when it is already low', () => {
    expect(lowStockAlertAt(product({ onHand: 3 }), settings, 1, now)).toEqual({ at: at(15, 9), pastDue: true });
    expect(lowStockAlertAt(product({ onHand: 0 }), settings, 1, at(14, 6))).toEqual({
      at: at(14, 9),
      pastDue: true,
    });
  });

  it('is past due when the alert day is today but its hour has gone by', () => {
    // Runs out Nov 21 noon; alert Nov 14 9 AM, which is three hours ago.
    expect(lowStockAlertAt(product({ onHand: 7 }), settings, 1, now)).toEqual({ at: at(15, 9), pastDue: true });
  });

  it('projects auto-deducted stock from the last deduction', () => {
    // Last deducted at midnight Nov 10 with 10 left: runs out Nov 20, alert Nov 13, past due.
    const p = product({ autoDeduct: true, lastAutoDeductAt: at(10, 0) });
    expect(lowStockAlertAt(p, settings, 1, now)).toEqual({ at: at(15, 9), pastDue: true });
    const fresh = product({ autoDeduct: true, lastAutoDeductAt: at(14, 0), onHand: 20 });
    expect(lowStockAlertAt(fresh, settings, 1, now)).toEqual({ at: at(27, 9), pastDue: false });
  });
});

describe('lowStockMessage', () => {
  it('names the product and the verdict', () => {
    expect(lowStockMessage(product({ verdict: 'reorder' }))).toEqual({
      title: 'Salmon Feast',
      body: 'Running low on Salmon Feast. You usually reorder this.',
    });
    expect(lowStockMessage(product()).body).toBe('Running low on Salmon Feast.');
    expect(lowStockMessage(product({ onHand: 0, verdict: 'reorder' })).body).toBe(
      "You're out of Salmon Feast. You usually reorder this.",
    );
  });

  it('asks for an alternative when marked skip', () => {
    expect(lowStockMessage(product({ verdict: 'skip' })).body).toBe(
      'Running low on Salmon Feast (marked skip). Pick an alternative.',
    );
  });
});

describe('planLowStockAlerts', () => {
  const rates = new Map<string, number>();

  it('plans one alert per product with a known rate, soonest first', () => {
    const { alerts } = planLowStockAlerts(
      [
        product({ id: 'late', onHand: 20 }),
        product({ id: 'soon', onHand: 10 }),
        product({ id: 'unknown', dailyUsage: null }),
        product({ id: 'archived', archived: true }),
      ],
      rates,
      settings,
      now,
      {},
    );
    expect(alerts.map((a) => [a.id, a.productId, a.date])).toEqual([
      ['lowstock:soon', 'soon', at(17, 9)],
      ['lowstock:late', 'late', at(27, 9)],
    ]);
    expect(alerts[0]?.body).toBe('Running low on Salmon Feast.');
  });

  it('uses learned rates', () => {
    const { alerts } = planLowStockAlerts([product({ dailyUsage: null })], new Map([['p1', 1]]), settings, now, {});
    expect(alerts[0]?.date).toEqual(at(17, 9));
  });

  it(`keeps the soonest ${String(ALERT_LIMIT)}`, () => {
    const many = Array.from({ length: 60 }, (_, i) => product({ id: `p${String(i)}`, onHand: 10 + i }));
    const { alerts } = planLowStockAlerts(many, rates, settings, now, {});
    expect(alerts).toHaveLength(ALERT_LIMIT);
    expect(alerts.at(-1)?.productId).toBe('p49');
  });

  describe('past due', () => {
    const low = product({ onHand: 3 });

    it('schedules once and remembers it', () => {
      const plan = planLowStockAlerts([low], rates, settings, now, {});
      expect(plan.alerts.map((a) => a.date)).toEqual([at(15, 9)]);
      expect(plan.fired).toEqual({ p1: { onHand: 3, at: at(15, 9).getTime() } });
    });

    it('keeps the same time while it is pending', () => {
      const fired = { p1: { onHand: 3, at: at(15, 9).getTime() } };
      const plan = planLowStockAlerts([low], rates, settings, at(14, 20), fired);
      expect(plan.alerts.map((a) => a.date)).toEqual([at(15, 9)]);
      expect(plan.fired).toEqual(fired);
    });

    it('does not repeat after it fired until stock changes', () => {
      const fired = { p1: { onHand: 3, at: at(15, 9).getTime() } };
      const later = planLowStockAlerts([low], rates, settings, at(15, 10), fired);
      expect(later.alerts).toEqual([]);
      expect(later.fired).toEqual(fired);

      const changed = planLowStockAlerts([product({ onHand: 2 })], rates, settings, at(15, 10), fired);
      expect(changed.alerts.map((a) => a.date)).toEqual([at(16, 9)]);
    });

    it('forgets a product once it is no longer low', () => {
      const fired = { p1: { onHand: 3, at: at(15, 9).getTime() } };
      expect(planLowStockAlerts([product({ onHand: 30 })], rates, settings, now, fired).fired).toEqual({});
    });
  });
});

describe('validateUsageForm', () => {
  const input = { dailyUsage: '', autoDeduct: false, lowStockMode: 'default' as const, lowStockValue: '' };

  it('accepts blanks as unknown and the household default', () => {
    expect(validateUsageForm(input)).toEqual({
      ok: true,
      fields: { dailyUsage: null, autoDeduct: false, lowStock: null },
    });
  });

  it('parses a daily amount, rounded to hundredths', () => {
    expect(validateUsageForm({ ...input, dailyUsage: '0.333', autoDeduct: true })).toEqual({
      ok: true,
      fields: { dailyUsage: 0.33, autoDeduct: true, lowStock: null },
    });
  });

  it('turns auto-deduct off without a daily amount', () => {
    const result = validateUsageForm({ ...input, autoDeduct: true });
    expect(result.ok && result.fields.autoDeduct).toBe(false);
  });

  it('rejects a daily amount that is not more than 0', () => {
    expect(validateUsageForm({ ...input, dailyUsage: 'abc' })).toMatchObject({ ok: false, errors: { dailyUsage: expect.any(String) } });
    expect(validateUsageForm({ ...input, dailyUsage: '0' })).toMatchObject({ ok: false, errors: { dailyUsage: expect.any(String) } });
  });

  it('builds a custom rule', () => {
    expect(validateUsageForm({ ...input, lowStockMode: 'days', lowStockValue: '3' })).toMatchObject({
      ok: true,
      fields: { lowStock: { mode: 'days', value: 3 } },
    });
    expect(validateUsageForm({ ...input, lowStockMode: 'amount', lowStockValue: '2.5' })).toMatchObject({
      ok: true,
      fields: { lowStock: { mode: 'amount', value: 2.5 } },
    });
  });

  it('needs a rule value above 0', () => {
    expect(validateUsageForm({ ...input, lowStockMode: 'days', lowStockValue: '' })).toMatchObject({
      ok: false,
      errors: { lowStock: expect.any(String) },
    });
    expect(validateUsageForm({ ...input, lowStockMode: 'amount', lowStockValue: '0' })).toMatchObject({
      ok: false,
      errors: { lowStock: expect.any(String) },
    });
  });
});

describe('usagePatch', () => {
  const fields = { dailyUsage: 1, autoDeduct: true, lowStock: null };

  it('starts auto-deduct from the start of today', () => {
    expect(usagePatch({ autoDeduct: false }, fields, now)).toEqual({ ...fields, lastAutoDeductAt: at(14, 0) });
  });

  it('keeps the mark while auto-deduct stays on', () => {
    expect(usagePatch({ autoDeduct: true }, fields, now)).toEqual(fields);
  });

  it('clears the mark when auto-deduct goes off', () => {
    expect(usagePatch({ autoDeduct: true }, { ...fields, autoDeduct: false }, now)).toEqual({
      ...fields,
      autoDeduct: false,
      lastAutoDeductAt: null,
    });
  });
});
