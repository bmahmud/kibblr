import { describe, expect, it } from 'vitest';

import { barcodeLookupSchema, lookupFormInput } from './lookup';
import type { BarcodeLookup } from './lookup';

const fancyFeast: BarcodeLookup = {
  barcode: '0050000429745',
  name: 'Tender Beef & Chicken Feast Classic Pate',
  brand: 'Fancy Feast',
  category: 'pate',
  container: 'can',
  size: { amount: 85, unit: 'g' },
  imageUrl: 'https://images.openpetfoodfacts.org/images/products/005/000/042/9745/front_en.3.400.jpg',
  source: 'openpetfoodfacts',
  cached: false,
};

describe('barcodeLookupSchema', () => {
  it('accepts a full result', () => {
    expect(barcodeLookupSchema.parse(fancyFeast)).toEqual(fancyFeast);
  });

  it('accepts a name-only result', () => {
    const minimal = { barcode: '0050000429745', name: 'Salmon Feast', brand: '', source: 'upcitemdb', cached: true };
    expect(barcodeLookupSchema.parse(minimal)).toEqual(minimal);
  });

  it('rejects a bad barcode, an empty name or an unknown source', () => {
    expect(barcodeLookupSchema.safeParse({ ...fancyFeast, barcode: '123' }).success).toBe(false);
    expect(barcodeLookupSchema.safeParse({ ...fancyFeast, name: ' ' }).success).toBe(false);
    expect(barcodeLookupSchema.safeParse({ ...fancyFeast, source: 'amazon' }).success).toBe(false);
  });
});

describe('lookupFormInput', () => {
  it('fills the create form from a lookup, with the size in the household unit', () => {
    expect(lookupFormInput(fancyFeast, 'lb', '1')).toEqual({
      mode: 'create',
      name: 'Tender Beef & Chicken Feast Classic Pate',
      brand: 'Fancy Feast',
      category: 'pate',
      container: 'can',
      sizeValue: '3',
      sizeUnit: 'oz',
      startingCount: '1',
      petIds: [],
      reorderUrl: '',
    });
    expect(lookupFormInput(fancyFeast, 'kg', '12')).toMatchObject({
      sizeValue: '85',
      sizeUnit: 'g',
      startingCount: '12',
    });
  });

  it('defaults to wet in a can when the type and package are unknown', () => {
    const { category, container, size, ...rest } = fancyFeast;
    void category;
    void container;
    void size;
    expect(lookupFormInput(rest, 'lb', '1')).toMatchObject({
      category: 'wet',
      container: 'can',
      sizeValue: '',
      sizeUnit: 'oz',
    });
  });

  it('picks the package from the type when only the type is known', () => {
    expect(
      lookupFormInput({ ...fancyFeast, category: 'dry', container: undefined, size: undefined }, 'lb', '1'),
    ).toMatchObject({
      category: 'dry',
      container: 'bag',
      sizeUnit: 'lb',
    });
  });
});
