import type { EventType } from './schemas';
import { roundBase } from './units';
import type { BaseUnit } from './units';

/**
 * The pure half of `applyStockChange` (spec section 5.3): what a requested
 * change actually does to `onHand`. The app runs it inside the Firestore
 * transaction, against the product as read there.
 */
export type StockChange = {
  before: number;
  after: number;
  /** The change actually applied, after clamping and rounding. Becomes the event's `delta`. */
  applied: number;
  /** True when a remove asked for more than was on hand. */
  clamped: boolean;
  /** The event type to record, or null when nothing changed (write no event). */
  type: EventType | null;
};

function assertFinite(value: number, what: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${what} must be a finite number (got ${value})`);
  }
}

function assertOnHand(onHand: number): void {
  assertFinite(onHand, 'onHand');
  if (onHand < 0) {
    throw new RangeError(`onHand must not be negative (got ${onHand})`);
  }
}

/** Adds or removes `delta`, clamping at 0: removing more than is on hand empties the product. */
export function computeStockChange(input: { onHand: number; delta: number; baseUnit: BaseUnit }): StockChange {
  const { onHand, delta, baseUnit } = input;
  assertOnHand(onHand);
  assertFinite(delta, 'delta');

  const requested = onHand + delta;
  const after = roundBase(Math.max(0, requested), baseUnit);
  const applied = roundBase(after - onHand, baseUnit);
  return {
    before: onHand,
    after: applied === 0 ? onHand : after,
    applied,
    clamped: requested < 0,
    type: applied === 0 ? null : applied > 0 ? 'add' : 'remove',
  };
}

/** Sets on hand to a counted amount ("I actually have 3 cans"), recorded as an adjust event. */
export function computeAdjustment(input: { onHand: number; target: number; baseUnit: BaseUnit }): StockChange {
  const { onHand, target, baseUnit } = input;
  assertOnHand(onHand);
  assertFinite(target, 'target');
  if (target < 0) {
    throw new RangeError(`target must not be negative (got ${target})`);
  }

  const after = roundBase(target, baseUnit);
  const applied = roundBase(after - onHand, baseUnit);
  return {
    before: onHand,
    after: applied === 0 ? onHand : after,
    applied,
    clamped: false,
    type: applied === 0 ? null : 'adjust',
  };
}

/** The delta that reverses an applied change (Undo). */
export function undoDelta(applied: number): number {
  return 0 - applied;
}
