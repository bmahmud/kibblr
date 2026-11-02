import { describe, expect, it } from 'vitest';

import {
  eventSchema,
  householdSchema,
  petSchema,
  productSchema,
  ratingSchema,
  userDocSchema,
} from './schemas';

const now = new Date('2026-11-01T12:00:00Z');

const household = {
  name: 'Home',
  memberUids: ['uid-1'],
  settings: { defaultLowStockDays: 7, notifyHour: 9, preferredWeightUnit: 'lb' },
  createdAt: now,
};

const pet = { name: 'Miso', species: 'cat', archived: false, createdAt: now };

const product = {
  barcode: '0012345678905',
  name: 'Indoor Adult',
  brand: 'Acme',
  category: 'dry',
  baseUnit: 'g',
  packageAmount: 5443,
  packageLabel: '12 lb bag',
  onHand: 2721.5,
  dailyUsage: 80,
  autoDeduct: false,
  lastAutoDeductAt: null,
  lowStock: null,
  petIds: ['pet-1'],
  verdict: 'undecided',
  verdictNote: null,
  reorderUrl: 'https://example.com/food',
  imageUrl: null,
  source: 'manual',
  archived: false,
  createdAt: now,
  updatedAt: now,
};

const rating = { petId: 'pet-1', reaction: 'loved', comment: null, createdAt: now };

const event = {
  productId: 'prod-1',
  petId: null,
  type: 'remove',
  method: 'manual',
  delta: -80,
  onHandAfter: 2641.5,
  note: null,
  createdAt: now,
  createdBy: 'uid-1',
};

describe('householdSchema', () => {
  it('accepts a valid household', () => {
    expect(householdSchema.parse(household)).toEqual(household);
  });

  it('requires at least one member', () => {
    expect(householdSchema.safeParse({ ...household, memberUids: [] }).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(householdSchema.safeParse({ ...household, name: '' }).success).toBe(false);
  });

  it.each([
    ['notifyHour below 0', { notifyHour: -1 }],
    ['notifyHour above 23', { notifyHour: 24 }],
    ['fractional notifyHour', { notifyHour: 9.5 }],
    ['zero low-stock days', { defaultLowStockDays: 0 }],
    ['unknown weight unit', { preferredWeightUnit: 'stone' }],
  ])('rejects %s', (_label, patch) => {
    const settings = { ...household.settings, ...patch };
    expect(householdSchema.safeParse({ ...household, settings }).success).toBe(false);
  });

  it('rejects a Firestore-style timestamp object instead of a Date', () => {
    expect(householdSchema.safeParse({ ...household, createdAt: { seconds: 1, nanoseconds: 0 } }).success).toBe(false);
  });
});

describe('petSchema', () => {
  it('accepts a valid pet', () => {
    expect(petSchema.parse(pet)).toEqual(pet);
  });

  it('rejects an unknown species', () => {
    expect(petSchema.safeParse({ ...pet, species: 'ferret' }).success).toBe(false);
  });
});

describe('productSchema', () => {
  it('accepts a valid product', () => {
    expect(productSchema.parse(product)).toEqual(product);
  });

  it('accepts a manual product with no barcode and an empty brand', () => {
    expect(productSchema.safeParse({ ...product, barcode: null, brand: '' }).success).toBe(true);
  });

  it('accepts a custom low-stock rule', () => {
    expect(productSchema.safeParse({ ...product, lowStock: { mode: 'days', value: 5 } }).success).toBe(true);
  });

  it.each([
    ['negative onHand', { onHand: -1 }],
    ['zero packageAmount', { packageAmount: 0 }],
    ['infinite onHand', { onHand: Number.POSITIVE_INFINITY }],
    ['zero dailyUsage', { dailyUsage: 0 }],
    ['12-digit barcode', { barcode: '012345678905' }],
    ['barcode with a letter', { barcode: '00123456789X5' }],
    ['unknown base unit', { baseUnit: 'lb' }],
    ['unknown category', { category: 'raw' }],
    ['unknown verdict', { verdict: 'maybe' }],
    ['non-http reorder URL', { reorderUrl: 'javascript:alert(1)' }],
    ['zero low-stock value', { lowStock: { mode: 'amount', value: 0 } }],
    ['empty name', { name: '' }],
  ])('rejects %s', (_label, patch) => {
    expect(productSchema.safeParse({ ...product, ...patch }).success).toBe(false);
  });
});

describe('ratingSchema', () => {
  it('accepts a valid rating', () => {
    expect(ratingSchema.parse(rating)).toEqual(rating);
  });

  it('rejects an unknown reaction', () => {
    expect(ratingSchema.safeParse({ ...rating, reaction: 'meh' }).success).toBe(false);
  });
});

describe('eventSchema', () => {
  it('accepts a valid event', () => {
    expect(eventSchema.parse(event)).toEqual(event);
  });

  it('accepts an adjust event in either direction', () => {
    expect(eventSchema.safeParse({ ...event, type: 'adjust', delta: 10 }).success).toBe(true);
    expect(eventSchema.safeParse({ ...event, type: 'adjust', delta: -10 }).success).toBe(true);
  });

  it.each([
    ['zero delta', { delta: 0 }],
    ['add with a negative delta', { type: 'add', delta: -5 }],
    ['remove with a positive delta', { type: 'remove', delta: 5 }],
    ['negative onHandAfter', { onHandAfter: -1 }],
    ['unknown method', { method: 'magic' }],
    ['empty createdBy', { createdBy: '' }],
  ])('rejects %s', (_label, patch) => {
    expect(eventSchema.safeParse({ ...event, ...patch }).success).toBe(false);
  });
});

describe('userDocSchema', () => {
  it('accepts a household pointer', () => {
    expect(userDocSchema.parse({ householdId: 'hid-1' })).toEqual({ householdId: 'hid-1' });
  });

  it('rejects an empty household id', () => {
    expect(userDocSchema.safeParse({ householdId: '' }).success).toBe(false);
  });
});
