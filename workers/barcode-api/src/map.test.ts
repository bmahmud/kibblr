import { describe, expect, it } from 'vitest';

import opff from './fixtures/openpetfoodfacts-fancy-feast.json';
import upc from './fixtures/upcitemdb-fancy-feast.json';
import { cleanName, guessCategory, guessContainer, mapOpenFacts, mapUpcItemDb } from './map';

const GTIN = '0050000429745';

describe('mapOpenFacts', () => {
  it('maps a real Open Pet Food Facts product', () => {
    expect(mapOpenFacts(GTIN, 'openpetfoodfacts', opff.product)).toEqual({
      barcode: GTIN,
      name: 'Tender Beef & Chicken Feast Classic Pate',
      brand: 'Fancy Feast',
      category: 'pate',
      size: { amount: 85, unit: 'g' },
      imageUrl: 'https://images.openpetfoodfacts.org/images/products/005/000/042/9745/front_en.3.400.jpg',
      source: 'openpetfoodfacts',
    });
  });

  it('uses the category and packaging tags when there are some', () => {
    const product = mapOpenFacts(GTIN, 'openpetfoodfacts', {
      product_name: 'Fresh carp & trout for adult cats',
      brands: 'Carnilove, Vafo',
      categories_tags: ['en:dog-and-cat-food', 'en:cat-food', 'en:dry-pet-food', 'en:dry-cat-food'],
      packaging_tags: ['en:plastic', 'en:bag'],
      product_quantity: '2000',
      product_quantity_unit: 'g',
    });
    expect(product).toMatchObject({
      name: 'Fresh carp & trout for adult cats',
      brand: 'Carnilove',
      category: 'dry',
      container: 'bag',
      size: { amount: 2000, unit: 'g' },
    });
  });

  it('falls back to parsing the quantity text', () => {
    expect(mapOpenFacts(GTIN, 'openfoodfacts', { product_name: 'Kibble', quantity: '16 lb' })?.size).toEqual({
      amount: 7257,
      unit: 'g',
    });
  });

  it('returns null without a name, and drops non-https images', () => {
    expect(mapOpenFacts(GTIN, 'openfoodfacts', { brands: 'Acme' })).toBeNull();
    expect(
      mapOpenFacts(GTIN, 'openfoodfacts', { product_name: 'X', image_front_url: 'http://a.b/c.jpg' }),
    ).not.toHaveProperty('imageUrl');
  });
});

describe('mapUpcItemDb', () => {
  it('maps a real UPCitemdb item, without the retailer image', () => {
    expect(mapUpcItemDb(GTIN, upc.items[0])).toEqual({
      barcode: GTIN,
      name: 'Classic Paté Gourmet Wet Cat Food Tender Beef & Chicken Feast',
      brand: 'Fancy Feast',
      category: 'pate',
      size: { amount: 85, unit: 'g' },
      source: 'upcitemdb',
    });
  });
});

describe('cleanName', () => {
  it('drops the brand, and a maker name before it, from the front', () => {
    expect(cleanName('Fancy Feast Salmon Feast', 'Fancy Feast')).toBe('Salmon Feast');
    expect(cleanName('Purina Fancy Feast Salmon Feast', 'Fancy Feast')).toBe('Salmon Feast');
    expect(cleanName('fancy feast - Salmon Feast', 'Fancy Feast')).toBe('Salmon Feast');
  });

  it('keeps the name when it is only the brand or the brand is elsewhere', () => {
    expect(cleanName('Fancy Feast', 'Fancy Feast')).toBe('Fancy Feast');
    expect(cleanName('Salmon Feast by Fancy Feast', 'Fancy Feast')).toBe('Salmon Feast by Fancy Feast');
    expect(cleanName('Salmon Feast', '')).toBe('Salmon Feast');
  });

  it('drops a trailing size and squeezes spaces', () => {
    expect(cleanName('Salmon  Feast - 3oz', '')).toBe('Salmon Feast');
    expect(cleanName('Indoor Kibble, 16 lb', '')).toBe('Indoor Kibble');
  });

  it('trims long names at a word', () => {
    const long = `${'Gourmet '.repeat(20)}Feast`;
    const cleaned = cleanName(long, '');
    expect(cleaned.length).toBeLessThanOrEqual(120);
    expect(cleaned.endsWith('Gourmet')).toBe(true);
  });
});

describe('guessCategory', () => {
  it.each([
    ['Classic Pate in Gravy', 'pate'],
    ['Classic Pâté', 'pate'],
    ['Salmon Feast in Gravy', 'wet'],
    ['en:wet-cat-food', 'wet'],
    ['Indoor dry cat food', 'dry'],
    ['Kibble', 'dry'],
    ['Temptations cat treats', 'treat'],
    ['Dental chews', 'treat'],
    ['Joint supplement chews', 'supplement'],
    ['Cat Food', undefined],
  ])('%s → %s', (text, expected) => {
    expect(guessCategory(text)).toBe(expected);
  });
});

describe('guessContainer', () => {
  it.each([
    ['en:can', 'can'],
    ['canned cat food', 'can'],
    ['12 pouches', 'pouch'],
    ['en:plastic en:bag', 'bag'],
    ['Cat Food', undefined],
  ])('%s → %s', (text, expected) => {
    expect(guessContainer(text)).toBe(expected);
  });
});
