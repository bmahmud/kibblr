import { computeAdjustment, computeStockChange } from '@kibblr/core';

import { stockChangeMessage } from './messages';

const kibble = { name: 'Kibble', baseUnit: 'g' as const };

describe('stockChangeMessage', () => {
  it('describes an add', () => {
    const change = computeStockChange({ onHand: 0, delta: 5443, baseUnit: 'g' });
    expect(stockChangeMessage(change, kibble, 'lb')).toBe('Added 12 lb of Kibble.');
  });

  it('describes a remove', () => {
    const change = computeStockChange({ onHand: 5443, delta: -454, baseUnit: 'g' });
    expect(stockChangeMessage(change, kibble, 'lb')).toBe('Used 1 lb of Kibble.');
  });

  it('tells me when a remove was clamped to what was on hand', () => {
    const change = computeStockChange({ onHand: 150, delta: -5443, baseUnit: 'g' });
    expect(stockChangeMessage(change, kibble, 'lb')).toBe('Only 5.3 oz was on hand. Kibble is now empty.');
  });

  it('tells me when there was nothing to remove', () => {
    const change = computeStockChange({ onHand: 0, delta: -100, baseUnit: 'g' });
    expect(stockChangeMessage(change, kibble, 'lb')).toBe('Kibble has nothing on hand.');
  });

  it('describes an adjustment', () => {
    const change = computeAdjustment({ onHand: 100, target: 2000, baseUnit: 'g' });
    expect(stockChangeMessage(change, kibble, 'kg')).toBe('Kibble set to 2 kg.');
  });

  it('describes a no-op adjustment', () => {
    const change = computeAdjustment({ onHand: 3, target: 3, baseUnit: 'count' });
    expect(stockChangeMessage(change, { name: 'Pate', baseUnit: 'count' }, 'lb')).toBe('Pate is unchanged.');
  });
});
