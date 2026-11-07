import { describe, expect, it } from 'vitest';

import { parseSizeText } from './size';

describe('parseSizeText', () => {
  it('reads weights with or without a space or trailing dot', () => {
    expect(parseSizeText('3oz')).toEqual({ amount: 85, unit: 'g' });
    expect(parseSizeText('3 oz.')).toEqual({ amount: 85, unit: 'g' });
    expect(parseSizeText('5.5 oz')).toEqual({ amount: 156, unit: 'g' });
    expect(parseSizeText('12 lb')).toEqual({ amount: 5443, unit: 'g' });
    expect(parseSizeText('12 lbs')).toEqual({ amount: 5443, unit: 'g' });
    expect(parseSizeText('1.5 kg')).toEqual({ amount: 1500, unit: 'g' });
    expect(parseSizeText('85 g')).toEqual({ amount: 85, unit: 'g' });
    expect(parseSizeText('400g')).toEqual({ amount: 400, unit: 'g' });
  });

  it('reads volumes', () => {
    expect(parseSizeText('12 fl oz')).toEqual({ amount: 355, unit: 'ml' });
    expect(parseSizeText('8 fl. oz.')).toEqual({ amount: 237, unit: 'ml' });
    expect(parseSizeText('250 ml')).toEqual({ amount: 250, unit: 'ml' });
    expect(parseSizeText('1 L')).toEqual({ amount: 1000, unit: 'ml' });
  });

  it('takes the first size when several are given', () => {
    expect(parseSizeText('3 oz (85 g)')).toEqual({ amount: 85, unit: 'g' });
    expect(parseSizeText('Net wt 16 LB (7.25 kg)')).toEqual({ amount: 7257, unit: 'g' });
  });

  it('accepts a decimal comma', () => {
    expect(parseSizeText('1,5 kg')).toEqual({ amount: 1500, unit: 'g' });
  });

  it('returns null when there is no usable size', () => {
    expect(parseSizeText('')).toBeNull();
    expect(parseSizeText('12 cans')).toBeNull();
    expect(parseSizeText('Large')).toBeNull();
    expect(parseSizeText('0 oz')).toBeNull();
  });
});
