import { roundCount } from './count';
import type { HouseholdSettings, LowStockRule, Product, StockEvent } from './schemas';
import { parseNumber } from './units';

/**
 * Consumption and low-stock prediction (spec sections 8 and 9): the learned
 * rate, auto-deduct, and when to remind me. All times are local.
 */

const DAY = 24 * 60 * 60 * 1000;

/** How far back the learned rate looks, and how much data it needs. */
export const LEARN_WINDOW_DAYS = 30;
export const LEARN_MIN_DAYS = 7;

/** iOS keeps at most 64 pending local notifications; leave room (spec section 9). */
export const ALERT_LIMIT = 50;

const LEARNED_METHODS: ReadonlySet<string> = new Set(['scan', 'manual', 'feeding']);

/** Midnight at the start of `date`'s local day. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole local calendar days from `from` to `to`; a 23- or 25-hour DST day still counts as one. */
export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY);
}

// ---------------------------------------------------------------------------
// Learned rate

export type RateEvent = Pick<StockEvent, 'productId' | 'type' | 'method' | 'delta' | 'note' | 'createdAt'>;

/**
 * Packages a day, learned from one product's events (spec section 8): uses by
 * scan, manual or feeding in the last 30 days, less the ones undone, over the
 * days since the first of them. Null with under 7 days of data or no net use.
 * `auto` is left out: it is the daily usage I set, not something learned.
 */
export function learnedRate(events: readonly RateEvent[], now: Date): number | null {
  const since = now.getTime() - LEARN_WINDOW_DAYS * DAY;
  let used = 0;
  let first: number | null = null;
  for (const event of events) {
    const time = event.createdAt.getTime();
    if (time < since || time > now.getTime() || !LEARNED_METHODS.has(event.method)) {
      continue;
    }
    if (event.type === 'remove') {
      used -= event.delta;
      first = first === null ? time : Math.min(first, time);
    } else if (event.type === 'add' && event.note === 'undo') {
      // Undo keeps the method of the use it reverses.
      used -= event.delta;
    }
  }
  if (first === null || used <= 0) {
    return null;
  }
  const days = (now.getTime() - first) / DAY;
  return days < LEARN_MIN_DAYS ? null : used / days;
}

/** Learned rates for every product with enough data, from the household's recent events. */
export function learnedRates(events: readonly RateEvent[], now: Date): Map<string, number> {
  const byProduct = new Map<string, RateEvent[]>();
  for (const event of events) {
    const list = byProduct.get(event.productId);
    if (list) {
      list.push(event);
    } else {
      byProduct.set(event.productId, [event]);
    }
  }
  const rates = new Map<string, number>();
  for (const [productId, list] of byProduct) {
    const rate = learnedRate(list, now);
    if (rate !== null) {
      rates.set(productId, rate);
    }
  }
  return rates;
}

/** The daily usage I set wins; otherwise the learned rate (spec section 8). */
export function effectiveRate(product: Pick<Product, 'dailyUsage'>, learned?: number | null): number | null {
  return product.dailyUsage ?? learned ?? null;
}

// ---------------------------------------------------------------------------
// Auto-deduct

export type AutoDeductPlan = {
  /** Whole days to deduct; 0 only when setting a missing mark. */
  days: number;
  /** Signed packages, rounded to hundredths. */
  delta: number;
  /** The new `lastAutoDeductAt`: the start of today. */
  nextAt: Date;
};

/** Where auto-deduct starts counting when I turn it on: today is not deducted. */
export function autoDeductBaseline(now: Date): Date {
  return startOfLocalDay(now);
}

/**
 * What auto-deduct should do now (spec section 8): one change for every
 * whole calendar day since `lastAutoDeductAt`. Moving the mark to the start of
 * today, not to now, keeps it idempotent within a day and loses no fraction.
 * The app runs this inside the stock transaction, against the product as read there.
 */
export function autoDeductPlan(
  product: Pick<Product, 'autoDeduct' | 'dailyUsage' | 'lastAutoDeductAt'>,
  now: Date,
): AutoDeductPlan | null {
  if (!product.autoDeduct || !product.dailyUsage) {
    return null;
  }
  const nextAt = startOfLocalDay(now);
  if (!product.lastAutoDeductAt) {
    return { days: 0, delta: 0, nextAt };
  }
  const days = calendarDaysBetween(product.lastAutoDeductAt, now);
  if (days <= 0) {
    return null;
  }
  return { days, delta: roundCount(-days * product.dailyUsage), nextAt };
}

// ---------------------------------------------------------------------------
// Low-stock reminders

export type AlertProduct = Pick<
  Product,
  'name' | 'onHand' | 'dailyUsage' | 'autoDeduct' | 'lastAutoDeductAt' | 'lowStock' | 'verdict' | 'archived'
> & { id: string };

type AlertSettings = Pick<HouseholdSettings, 'defaultLowStockDays' | 'notifyHour'>;

/** The next time the clock reads `hour`:00 after `now`. */
export function nextNotifyTime(now: Date, hour: number): Date {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * When to remind me about a product (spec section 9), or null when its rate
 * is unknown. Days rule: the run-out date less the rule's days. Amount rule:
 * the date on hand reaches the amount. Either way at the notify hour of that
 * day. If that has passed, it is already low: the next notify hour, past due.
 *
 * Auto-deducted stock is projected from the last deduction, so the date
 * stays right even when the app isn't opened to deduct.
 */
export function lowStockAlertAt(
  product: Omit<AlertProduct, 'id' | 'name' | 'verdict' | 'archived'>,
  settings: AlertSettings,
  rate: number | null,
  now: Date,
): { at: Date; pastDue: boolean } | null {
  if (!rate) {
    return null;
  }
  const rule: LowStockRule = product.lowStock ?? { mode: 'days', value: settings.defaultLowStockDays };
  const daysUntilLow =
    rule.mode === 'days' ? product.onHand / rate - rule.value : (product.onHand - rule.value) / rate;
  const base =
    product.autoDeduct && product.dailyUsage && product.lastAutoDeductAt ? product.lastAutoDeductAt : now;
  const low = new Date(base.getTime() + daysUntilLow * DAY);
  const at = new Date(low.getFullYear(), low.getMonth(), low.getDate(), settings.notifyHour);
  if (at.getTime() > now.getTime()) {
    return { at, pastDue: false };
  }
  return { at: nextNotifyTime(now, settings.notifyHour), pastDue: true };
}

/** The reminder's text: names the product and the verdict (spec section 9). */
export function lowStockMessage(product: Pick<AlertProduct, 'name' | 'onHand' | 'verdict'>): {
  title: string;
  body: string;
} {
  const { name } = product;
  if (product.verdict === 'skip') {
    return { title: name, body: `Running low on ${name} (marked skip). Pick an alternative.` };
  }
  const state = product.onHand === 0 ? `You're out of ${name}.` : `Running low on ${name}.`;
  return { title: name, body: product.verdict === 'reorder' ? `${state} You usually reorder this.` : state };
}

export type LowStockAlert = {
  /** The notification identifier: `lowstock:<productId>`. */
  id: string;
  productId: string;
  date: Date;
  title: string;
  body: string;
};

/**
 * Past-due reminders already scheduled, by product: the on-hand count then and
 * when it was due. A past-due reminder fires once and is not repeated until
 * the count changes (spec section 9).
 */
export type FiredAlerts = Record<string, { onHand: number; at: number }>;

/**
 * Every reminder that should be pending now, soonest first and at most
 * ALERT_LIMIT, plus the past-due record to keep. Archived products and
 * products with no known rate get none.
 */
export function planLowStockAlerts(
  products: readonly AlertProduct[],
  rates: ReadonlyMap<string, number>,
  settings: AlertSettings,
  now: Date,
  fired: FiredAlerts,
): { alerts: LowStockAlert[]; fired: FiredAlerts } {
  const candidates: (LowStockAlert & { pastDue: boolean; onHand: number })[] = [];
  const suppressed: FiredAlerts = {};

  for (const product of products) {
    if (product.archived) {
      continue;
    }
    const alert = lowStockAlertAt(product, settings, effectiveRate(product, rates.get(product.id)), now);
    if (!alert) {
      continue;
    }
    let date = alert.at;
    const previous = fired[product.id];
    if (alert.pastDue && previous && previous.onHand === product.onHand) {
      if (previous.at <= now.getTime()) {
        // Already went off for this count.
        suppressed[product.id] = previous;
        continue;
      }
      date = new Date(previous.at);
    }
    candidates.push({
      id: `lowstock:${product.id}`,
      productId: product.id,
      date,
      pastDue: alert.pastDue,
      onHand: product.onHand,
      ...lowStockMessage(product),
    });
  }

  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const kept = candidates.slice(0, ALERT_LIMIT);
  const nextFired: FiredAlerts = { ...suppressed };
  for (const alert of kept) {
    if (alert.pastDue) {
      nextFired[alert.productId] = { onHand: alert.onHand, at: alert.date.getTime() };
    }
  }
  return {
    alerts: kept.map(({ id, productId, date, title, body }) => ({ id, productId, date, title, body })),
    fired: nextFired,
  };
}

// ---------------------------------------------------------------------------
// Usage form (product detail)

export type LowStockMode = 'default' | LowStockRule['mode'];

export type UsageFormInput = {
  /** Packages a day, as typed; blank means unknown. */
  dailyUsage: string;
  autoDeduct: boolean;
  lowStockMode: LowStockMode;
  lowStockValue: string;
};

export type UsageFields = Pick<Product, 'dailyUsage' | 'autoDeduct' | 'lowStock'>;

export type UsageFormResult =
  | { ok: true; fields: UsageFields }
  | { ok: false; errors: Partial<Record<'dailyUsage' | 'lowStock', string>> };

export function validateUsageForm(input: UsageFormInput): UsageFormResult {
  const errors: Partial<Record<'dailyUsage' | 'lowStock', string>> = {};

  let dailyUsage: number | null = null;
  if (input.dailyUsage.trim()) {
    const value = parseNumber(input.dailyUsage);
    const rounded = value === null ? 0 : roundCount(value);
    if (rounded <= 0) {
      errors.dailyUsage = 'Enter an amount more than 0, like 1 or 0.5, or leave it blank.';
    } else {
      dailyUsage = rounded;
    }
  }

  let lowStock: LowStockRule | null = null;
  if (input.lowStockMode !== 'default') {
    const value = parseNumber(input.lowStockValue);
    if (value === null || value <= 0) {
      errors.lowStock = input.lowStockMode === 'days' ? 'Enter a number of days, like 7.' : 'Enter an amount, like 2.';
    } else {
      lowStock = { mode: input.lowStockMode, value: roundCount(value) };
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, fields: { dailyUsage, autoDeduct: input.autoDeduct && dailyUsage !== null, lowStock } };
}

/** The form's starting values. */
export function usageFormValues(product: UsageFields): UsageFormInput {
  return {
    dailyUsage: product.dailyUsage === null ? '' : String(product.dailyUsage),
    autoDeduct: product.autoDeduct,
    lowStockMode: product.lowStock?.mode ?? 'default',
    lowStockValue: product.lowStock ? String(product.lowStock.value) : '',
  };
}

/**
 * The product update for saved usage fields. Turning auto-deduct on starts
 * counting from today; turning it off clears the mark.
 */
export function usagePatch(
  product: Pick<Product, 'autoDeduct'>,
  fields: UsageFields,
  now: Date,
): UsageFields & { lastAutoDeductAt?: Date | null } {
  if (fields.autoDeduct && !product.autoDeduct) {
    return { ...fields, lastAutoDeductAt: autoDeductBaseline(now) };
  }
  if (!fields.autoDeduct && product.autoDeduct) {
    return { ...fields, lastAutoDeductAt: null };
  }
  return fields;
}
