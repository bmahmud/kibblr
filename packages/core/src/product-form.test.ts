import { describe, expect, it } from 'vitest';

import { newProductDraft, productFormValues, validateProductForm } from './product-form';
import type { ProductFormInput } from './product-form';
import { productSchema } from './schemas';

const valid: ProductFormInput = {
  mode: 'create',
  name: '  Salmon Feast ',
  brand: ' Fancy Feast ',
  category: 'pate',
  container: 'can',
  sizeValue: '3',
  sizeUnit: 'oz',
  startingCount: '12',
};

describe('validateProductForm', () => {
  it('builds trimmed fields, the size in base units and the starting count', () => {
    expect(validateProductForm(valid)).toEqual({
      ok: true,
      fields: {
        name: 'Salmon Feast',
        brand: 'Fancy Feast',
        category: 'pate',
        container: 'can',
        size: { amount: 85, unit: 'g' },
      },
      startingCount: 12,
    });
  });

  it('makes the size optional', () => {
    const result = validateProductForm({ ...valid, sizeValue: '  ' });
    expect(result.ok && result.fields.size).toBeNull();
  });

  it('stores a volume size in millilitres', () => {
    const result = validateProductForm({ ...valid, container: 'bottle', sizeValue: '8', sizeUnit: 'floz' });
    expect(result.ok && result.fields.size).toEqual({ amount: 237, unit: 'ml' });
  });

  it('treats an empty starting count as zero', () => {
    const result = validateProductForm({ ...valid, startingCount: ' ' });
    expect(result.ok && result.startingCount).toBe(0);
  });

  it('allows a fractional starting count, rounded to hundredths', () => {
    expect(validateProductForm({ ...valid, startingCount: '1.5' })).toMatchObject({ startingCount: 1.5 });
    expect(validateProductForm({ ...valid, startingCount: '0.333' })).toMatchObject({ startingCount: 0.33 });
  });

  it('ignores the starting count when editing', () => {
    const result = validateProductForm({ ...valid, mode: 'edit', startingCount: 'nonsense' });
    expect(result.ok && result.startingCount).toBe(0);
  });

  it('requires a name and keeps it and the brand within limits', () => {
    expect(validateProductForm({ ...valid, name: '   ' })).toEqual({
      ok: false,
      errors: { name: 'Enter a name.' },
    });
    expect(validateProductForm({ ...valid, name: 'x'.repeat(121) })).toMatchObject({
      ok: false,
      errors: { name: 'Keep the name under 120 characters.' },
    });
    expect(validateProductForm({ ...valid, brand: 'x'.repeat(81) })).toMatchObject({
      ok: false,
      errors: { brand: 'Keep the brand under 80 characters.' },
    });
  });

  it('allows an empty brand', () => {
    const result = validateProductForm({ ...valid, brand: '' });
    expect(result.ok && result.fields.brand).toBe('');
  });

  it('rejects a size that is not a positive number', () => {
    expect(validateProductForm({ ...valid, sizeValue: 'three' })).toMatchObject({
      errors: { size: 'Enter a number, like 3 or 5.5, or leave it blank.' },
    });
    expect(validateProductForm({ ...valid, sizeValue: '0' })).toMatchObject({
      errors: { size: 'The size must be more than 0.' },
    });
    // Rounds to 0 g.
    expect(validateProductForm({ ...valid, sizeValue: '0.001' })).toMatchObject({
      errors: { size: 'The size must be more than 0.' },
    });
  });

  it('rejects a starting count that is not a number', () => {
    expect(validateProductForm({ ...valid, startingCount: '-1' })).toMatchObject({
      errors: { startingCount: 'Enter 0 or more, like 12 or 1.5.' },
    });
  });

  it('reports every error at once', () => {
    const result = validateProductForm({ ...valid, name: '', sizeValue: 'x', startingCount: 'x' });
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['name', 'size', 'startingCount']);
  });
});

describe('newProductDraft', () => {
  it('fills the spec defaults, and parses as a product once stock and timestamps are set', () => {
    const result = validateProductForm(valid);
    if (!result.ok) {
      throw new Error('expected a valid form');
    }
    const draft = newProductDraft(result.fields);
    expect(draft).toMatchObject({
      barcode: null,
      dailyUsage: null,
      autoDeduct: false,
      lastAutoDeductAt: null,
      lowStock: null,
      petIds: [],
      verdict: 'undecided',
      verdictNote: null,
      reorderUrl: null,
      imageUrl: null,
      source: 'manual',
      archived: false,
    });
    const now = new Date();
    expect(productSchema.safeParse({ ...draft, onHand: 0, createdAt: now, updatedAt: now }).success).toBe(true);
  });
});

describe('productFormValues', () => {
  it('prefills the edit form, showing the size in the household unit', () => {
    expect(
      productFormValues(
        { name: 'Kibble', brand: 'Acme', category: 'dry', container: 'bag', size: { amount: 7257, unit: 'g' } },
        'lb',
      ),
    ).toEqual({
      mode: 'edit',
      name: 'Kibble',
      brand: 'Acme',
      category: 'dry',
      container: 'bag',
      sizeValue: '16',
      sizeUnit: 'lb',
      startingCount: '',
    });
  });

  it("leaves the size blank and starts on the container's default unit when there is none", () => {
    const values = productFormValues(
      { name: 'Pate', brand: '', category: 'pate', container: 'can', size: null },
      'kg',
    );
    expect(values.sizeValue).toBe('');
    expect(values.sizeUnit).toBe('g');
  });

  it('round-trips: saving the prefilled form leaves the size unchanged', () => {
    for (const size of [
      { amount: 85, unit: 'g' },
      { amount: 156, unit: 'g' },
      { amount: 7257, unit: 'g' },
      { amount: 355, unit: 'ml' },
    ] as const) {
      for (const preferred of ['lb', 'kg'] as const) {
        const values = productFormValues({ name: 'X', brand: '', category: 'wet', container: 'can', size }, preferred);
        const result = validateProductForm(values);
        expect(result.ok && result.fields.size).toEqual(size);
      }
    }
  });
});
