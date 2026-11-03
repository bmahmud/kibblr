import { computeAdjustment, computeStockChange } from '@kibblr/core';

import { stockChangeMessage } from './messages';

const pate = { name: 'Salmon Feast', container: 'can' as const };
const kibble = { name: 'Kibble', container: 'bag' as const };

describe('stockChangeMessage', () => {
  it('describes an add in packages', () => {
    expect(stockChangeMessage(computeStockChange({ onHand: 0, delta: 12 }), pate)).toBe('Added 12 cans of Salmon Feast.');
    expect(stockChangeMessage(computeStockChange({ onHand: 0, delta: 1 }), pate)).toBe('Added 1 can of Salmon Feast.');
  });

  it('describes a remove', () => {
    expect(stockChangeMessage(computeStockChange({ onHand: 12, delta: -1 }), pate)).toBe('Used 1 can of Salmon Feast.');
    expect(stockChangeMessage(computeStockChange({ onHand: 2, delta: -0.5 }), kibble)).toBe('Used 0.5 bags of Kibble.');
  });

  it('tells me when a remove was clamped to what was on hand', () => {
    expect(stockChangeMessage(computeStockChange({ onHand: 1, delta: -3 }), pate)).toBe(
      'Only 1 can was on hand. Salmon Feast is now empty.',
    );
    expect(stockChangeMessage(computeStockChange({ onHand: 0.5, delta: -1 }), kibble)).toBe(
      'Only 0.5 bags were on hand. Kibble is now empty.',
    );
  });

  it('tells me when there was nothing to remove', () => {
    expect(stockChangeMessage(computeStockChange({ onHand: 0, delta: -1 }), pate)).toBe('Salmon Feast has nothing on hand.');
  });

  it('describes an adjustment', () => {
    expect(stockChangeMessage(computeAdjustment({ onHand: 4, target: 10 }), pate)).toBe('Salmon Feast set to 10 cans.');
  });

  it('describes a no-op adjustment', () => {
    expect(stockChangeMessage(computeAdjustment({ onHand: 3, target: 3 }), pate)).toBe('Salmon Feast is unchanged.');
  });
});
