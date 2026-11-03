import { describe, expect, it } from 'vitest';

import { computeAdjustment, computeStockChange, undoDelta } from './stock';

describe('computeStockChange', () => {
  it('adds packages', () => {
    expect(computeStockChange({ onHand: 4, delta: 12 })).toEqual({
      before: 4,
      after: 16,
      applied: 12,
      clamped: false,
      type: 'add',
    });
  });

  it('removes packages', () => {
    expect(computeStockChange({ onHand: 12, delta: -1 })).toEqual({
      before: 12,
      after: 11,
      applied: -1,
      clamped: false,
      type: 'remove',
    });
  });

  it('removes exactly what is on hand without clamping', () => {
    const change = computeStockChange({ onHand: 2, delta: -2 });
    expect(change.after).toBe(0);
    expect(change.applied).toBe(-2);
    expect(change.clamped).toBe(false);
  });

  it('clamps at zero and records only what was actually removed', () => {
    expect(computeStockChange({ onHand: 1.5, delta: -3 })).toEqual({
      before: 1.5,
      after: 0,
      applied: -1.5,
      clamped: true,
      type: 'remove',
    });
  });

  it('is a no-op (type null) when removing from an empty product', () => {
    expect(computeStockChange({ onHand: 0, delta: -1 })).toEqual({
      before: 0,
      after: 0,
      applied: 0,
      clamped: true,
      type: null,
    });
  });

  it('is a no-op for a zero delta', () => {
    const change = computeStockChange({ onHand: 10, delta: 0 });
    expect(change.type).toBeNull();
    expect(change.applied).toBe(0);
    expect(change.clamped).toBe(false);
  });

  it('rounds to hundredths of a package so float drift never reaches storage', () => {
    const change = computeStockChange({ onHand: 0.1, delta: 0.2 });
    expect(change.after).toBe(0.3);
    expect(change.applied).toBe(0.2);

    const third = computeStockChange({ onHand: 2, delta: -1 / 3 });
    expect(third.after).toBe(1.67);
    expect(third.applied).toBe(-0.33);
  });

  it('treats a delta that rounds to zero as a no-op', () => {
    expect(computeStockChange({ onHand: 5, delta: 0.001 }).type).toBeNull();
  });

  it('rejects non-finite input and negative on-hand values', () => {
    expect(() => computeStockChange({ onHand: 10, delta: Number.NaN })).toThrow(RangeError);
    expect(() => computeStockChange({ onHand: Number.POSITIVE_INFINITY, delta: 1 })).toThrow(RangeError);
    expect(() => computeStockChange({ onHand: -1, delta: 1 })).toThrow(RangeError);
  });
});

describe('computeAdjustment', () => {
  it('sets on hand to a counted number as an adjust event, either direction', () => {
    expect(computeAdjustment({ onHand: 4, target: 10 })).toEqual({
      before: 4,
      after: 10,
      applied: 6,
      clamped: false,
      type: 'adjust',
    });
    expect(computeAdjustment({ onHand: 4, target: 0 }).applied).toBe(-4);
  });

  it('is a no-op when the target equals what is on hand', () => {
    expect(computeAdjustment({ onHand: 3, target: 3 }).type).toBeNull();
  });

  it('rounds the target to hundredths', () => {
    expect(computeAdjustment({ onHand: 0, target: 2.004 }).after).toBe(2);
  });

  it('rejects a negative or non-finite target', () => {
    expect(() => computeAdjustment({ onHand: 3, target: -1 })).toThrow(RangeError);
    expect(() => computeAdjustment({ onHand: 3, target: Number.NaN })).toThrow(RangeError);
  });
});

describe('undoDelta', () => {
  it('inverts the applied change', () => {
    expect(undoDelta(12)).toBe(-12);
    expect(undoDelta(-1.5)).toBe(1.5);
  });

  it('restores the original amount after a clamped remove', () => {
    const removed = computeStockChange({ onHand: 1.5, delta: -3 });
    const undone = computeStockChange({ onHand: removed.after, delta: undoDelta(removed.applied) });
    expect(undone.after).toBe(1.5);
    expect(undone.type).toBe('add');
  });

  it('restores the original amount after an adjustment', () => {
    const adjusted = computeAdjustment({ onHand: 7, target: 20 });
    const undone = computeStockChange({ onHand: adjusted.after, delta: undoDelta(adjusted.applied) });
    expect(undone.after).toBe(7);
  });
});
