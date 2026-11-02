import { describe, expect, it } from 'vitest';

import { computeAdjustment, computeStockChange, undoDelta } from './stock';

describe('computeStockChange', () => {
  it('adds stock', () => {
    expect(computeStockChange({ onHand: 1000, delta: 5443, baseUnit: 'g' })).toEqual({
      before: 1000,
      after: 6443,
      applied: 5443,
      clamped: false,
      type: 'add',
    });
  });

  it('removes stock', () => {
    expect(computeStockChange({ onHand: 1000, delta: -250, baseUnit: 'g' })).toEqual({
      before: 1000,
      after: 750,
      applied: -250,
      clamped: false,
      type: 'remove',
    });
  });

  it('removes exactly what is on hand without clamping', () => {
    const change = computeStockChange({ onHand: 400, delta: -400, baseUnit: 'g' });
    expect(change.after).toBe(0);
    expect(change.applied).toBe(-400);
    expect(change.clamped).toBe(false);
  });

  it('clamps at zero and records only what was actually removed', () => {
    expect(computeStockChange({ onHand: 300, delta: -1000, baseUnit: 'g' })).toEqual({
      before: 300,
      after: 0,
      applied: -300,
      clamped: true,
      type: 'remove',
    });
  });

  it('is a no-op (type null) when removing from an empty product', () => {
    expect(computeStockChange({ onHand: 0, delta: -500, baseUnit: 'g' })).toEqual({
      before: 0,
      after: 0,
      applied: 0,
      clamped: true,
      type: null,
    });
  });

  it('is a no-op for a zero delta', () => {
    const change = computeStockChange({ onHand: 10, delta: 0, baseUnit: 'count' });
    expect(change.type).toBeNull();
    expect(change.applied).toBe(0);
    expect(change.clamped).toBe(false);
  });

  it('rounds to the base unit so float drift never reaches storage', () => {
    const change = computeStockChange({ onHand: 0.1, delta: 0.2, baseUnit: 'count' });
    expect(change.after).toBe(0.3);
    expect(change.applied).toBe(0.2);

    const grams = computeStockChange({ onHand: 1000, delta: -113.4, baseUnit: 'g' });
    expect(grams.after).toBe(887);
    expect(grams.applied).toBe(-113);
  });

  it('treats a delta that rounds to zero as a no-op', () => {
    expect(computeStockChange({ onHand: 1000, delta: 0.3, baseUnit: 'g' }).type).toBeNull();
  });

  it('rejects non-finite input and negative on-hand values', () => {
    expect(() => computeStockChange({ onHand: 10, delta: Number.NaN, baseUnit: 'g' })).toThrow(RangeError);
    expect(() => computeStockChange({ onHand: Number.POSITIVE_INFINITY, delta: 1, baseUnit: 'g' })).toThrow(
      RangeError,
    );
    expect(() => computeStockChange({ onHand: -1, delta: 1, baseUnit: 'g' })).toThrow(RangeError);
  });
});

describe('computeAdjustment', () => {
  it('sets on hand to a target as an adjust event, either direction', () => {
    expect(computeAdjustment({ onHand: 1000, target: 2500, baseUnit: 'g' })).toEqual({
      before: 1000,
      after: 2500,
      applied: 1500,
      clamped: false,
      type: 'adjust',
    });
    expect(computeAdjustment({ onHand: 1000, target: 0, baseUnit: 'g' }).applied).toBe(-1000);
  });

  it('is a no-op when the target equals what is on hand', () => {
    expect(computeAdjustment({ onHand: 3, target: 3, baseUnit: 'count' }).type).toBeNull();
  });

  it('rounds the target to the base unit', () => {
    expect(computeAdjustment({ onHand: 0, target: 2.004, baseUnit: 'count' }).after).toBe(2);
  });

  it('rejects a negative or non-finite target', () => {
    expect(() => computeAdjustment({ onHand: 3, target: -1, baseUnit: 'count' })).toThrow(RangeError);
    expect(() => computeAdjustment({ onHand: 3, target: Number.NaN, baseUnit: 'count' })).toThrow(RangeError);
  });
});

describe('undoDelta', () => {
  it('inverts the applied change', () => {
    expect(undoDelta(5443)).toBe(-5443);
    expect(undoDelta(-300)).toBe(300);
  });

  it('restores the original amount after a clamped remove', () => {
    const removed = computeStockChange({ onHand: 300, delta: -1000, baseUnit: 'g' });
    const undone = computeStockChange({ onHand: removed.after, delta: undoDelta(removed.applied), baseUnit: 'g' });
    expect(undone.after).toBe(300);
    expect(undone.type).toBe('add');
  });

  it('restores the original amount after an adjustment', () => {
    const adjusted = computeAdjustment({ onHand: 750, target: 2000, baseUnit: 'g' });
    const undone = computeStockChange({ onHand: adjusted.after, delta: undoDelta(adjusted.applied), baseUnit: 'g' });
    expect(undone.after).toBe(750);
  });
});
