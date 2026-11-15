import { describe, expect, it } from 'vitest';

import { buildExport, eventsForPet, exportFileName } from './export';
import type { ExportInput } from './export';
import { DEFAULT_HOUSEHOLD_SETTINGS } from './household';
import { newProductDraft } from './product-form';
import type { Product, StockEvent, WithId } from './schemas';

const now = new Date(Date.UTC(2026, 10, 15, 18, 30));
const created = new Date(Date.UTC(2026, 10, 1, 9));
const photo = `data:image/jpeg;base64,${'A'.repeat(1000)}`;

function product(id: string, overrides: Partial<Product> = {}): WithId<Product> {
  const draft = newProductDraft({
    name: `Food ${id}`,
    brand: 'Acme',
    category: 'wet',
    container: 'can',
    size: null,
    petIds: [],
    reorderUrl: null,
  });
  return { ...draft, id, onHand: 3, createdAt: created, updatedAt: created, ...overrides };
}

function event(id: string, productId: string, petId: string | null = null): WithId<StockEvent> {
  return {
    id,
    productId,
    petId,
    type: 'remove',
    method: 'manual',
    delta: -1,
    onHandAfter: 2,
    note: null,
    createdAt: created,
    createdBy: 'uid-1',
  };
}

function input(overrides: Partial<ExportInput> = {}): ExportInput {
  return {
    household: {
      id: 'h1',
      name: 'Home',
      memberUids: ['uid-1'],
      settings: DEFAULT_HOUSEHOLD_SETTINGS,
      createdAt: created,
    },
    pets: [{ id: 'pet-b', name: 'Mocha', species: 'cat', photo, archived: false, createdAt: created }],
    products: [product('p2', { photo }), product('p1')],
    ratings: [
      { id: 'r1', productId: 'p1', petId: 'pet-b', reaction: 'loved', comment: null, createdAt: created },
    ],
    events: [event('e2', 'p1'), event('e1', 'p2')],
    ...overrides,
  };
}

describe('buildExport', () => {
  const data = buildExport(input(), now);

  it('has a header to tell what and when', () => {
    expect(data).toMatchObject({ app: 'kibblr', version: 1, exportedAt: '2026-11-15T18:30:00.000Z' });
  });

  it("keeps the household's name and settings, not its member ids", () => {
    expect(data.household).toEqual({
      id: 'h1',
      name: 'Home',
      settings: DEFAULT_HOUSEHOLD_SETTINGS,
      createdAt: '2026-11-01T09:00:00.000Z',
    });
  });

  it('sorts by id and turns dates into ISO strings', () => {
    expect(data.products.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(data.events.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(data.products[0]?.createdAt).toBe('2026-11-01T09:00:00.000Z');
    expect(data.ratings[0]).toMatchObject({ productId: 'p1', createdAt: '2026-11-01T09:00:00.000Z' });
  });

  it('flags photos instead of embedding them', () => {
    expect(data.pets[0]).toMatchObject({ name: 'Mocha', hasPhoto: true });
    expect(data.pets[0]).not.toHaveProperty('photo');
    expect(data.products.map((p) => p.hasPhoto)).toEqual([false, true]);
    expect(JSON.stringify(data)).not.toContain('base64');
  });

  it('survives JSON', () => {
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});

describe('exportFileName', () => {
  it('is dated in local time', () => {
    expect(exportFileName(new Date(2026, 10, 15, 23, 59))).toBe('kibblr-export-2026-11-15.json');
    expect(exportFileName(new Date(2026, 0, 5))).toBe('kibblr-export-2026-01-05.json');
  });
});

describe('eventsForPet', () => {
  it("keeps events for the pet or for foods it eats or rated, in the given order", () => {
    const products = [
      product('eats', { petIds: ['pet-a'] }),
      product('rated', { ratedBy: ['pet-a'] }),
      product('other'),
    ];
    const events = [
      event('1', 'other'),
      event('2', 'rated'),
      event('3', 'other', 'pet-a'),
      event('4', 'eats'),
      event('5', 'gone'),
    ];
    expect(eventsForPet(events, products, 'pet-a').map((e) => e.id)).toEqual(['2', '3', '4']);
  });
});
