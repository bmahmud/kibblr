import { describe, expect, it } from 'vitest';

import { newProductDraft, productFormValues, validateProductForm } from './product-form';
import type { ProductFormInput } from './product-form';
import { productSchema } from './schemas';

const valid: ProductFormInput = {
  mode: 'create',
  name: '  Chicken Kibble ',
  brand: ' Acme ',
  category: 'dry',
  baseUnit: 'g',
  packageSize: '12',
  packageUnit: 'lb',
  startingPackages: '2',
};

describe('validateProductForm', () => {
  it('builds trimmed fields, the package amount in base units and a label', () => {
    const result = validateProductForm(valid);
    expect(result).toEqual({
      ok: true,
      fields: {
        name: 'Chicken Kibble',
        brand: 'Acme',
        category: 'dry',
        baseUnit: 'g',
        packageAmount: 5443,
        packageLabel: '12 lb',
      },
      startingAmount: 10886,
    });
  });

  it('treats an empty starting amount as zero', () => {
    const result = validateProductForm({ ...valid, startingPackages: ' ' });
    expect(result.ok && result.startingAmount).toBe(0);
  });

  it('allows fractional starting packages', () => {
    const result = validateProductForm({ ...valid, startingPackages: '0.5' });
    expect(result.ok && result.startingAmount).toBe(2722);
  });

  it('uses the unit label in the package label', () => {
    const result = validateProductForm({ ...valid, baseUnit: 'ml', packageSize: '13.2', packageUnit: 'floz' });
    expect(result.ok && result.fields.packageLabel).toBe('13.2 fl oz');
    expect(result.ok && result.fields.packageAmount).toBe(390);

    const cans = validateProductForm({ ...valid, baseUnit: 'count', packageSize: '1', packageUnit: 'count' });
    expect(cans.ok && cans.fields.packageLabel).toBe('1 ct');
  });

  it('ignores the starting amount when editing', () => {
    const result = validateProductForm({ ...valid, mode: 'edit', startingPackages: 'nonsense' });
    expect(result.ok && result.startingAmount).toBe(0);
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

  it('requires a positive package size', () => {
    expect(validateProductForm({ ...valid, packageSize: '' })).toMatchObject({
      errors: { packageSize: 'Enter the package size.' },
    });
    expect(validateProductForm({ ...valid, packageSize: 'twelve' })).toMatchObject({
      errors: { packageSize: 'Enter a number, like 12 or 5.5.' },
    });
    expect(validateProductForm({ ...valid, packageSize: '0' })).toMatchObject({
      errors: { packageSize: 'The package size must be more than 0.' },
    });
    // Rounds to 0 g, which would make every scan a no-op.
    expect(validateProductForm({ ...valid, packageSize: '0.001', packageUnit: 'oz' })).toMatchObject({
      errors: { packageSize: 'The package size must be more than 0.' },
    });
  });

  it("rejects a package unit that doesn't match the base unit", () => {
    expect(validateProductForm({ ...valid, baseUnit: 'count', packageUnit: 'lb' })).toMatchObject({
      errors: { packageSize: 'Pick a unit for the package size.' },
    });
  });

  it('rejects a starting amount that is not a number', () => {
    expect(validateProductForm({ ...valid, startingPackages: '-1' })).toMatchObject({
      errors: { startingPackages: 'Enter 0 or more packages.' },
    });
  });

  it('reports every error at once', () => {
    const result = validateProductForm({ ...valid, name: '', packageSize: '', startingPackages: 'x' });
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['name', 'packageSize', 'startingPackages']);
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
  it('prefills the edit form from a product, keeping the unit from its label', () => {
    expect(
      productFormValues(
        { name: 'Kibble', brand: 'Acme', category: 'dry', baseUnit: 'g', packageAmount: 5443, packageLabel: '12 lb' },
        'kg',
      ),
    ).toEqual({
      mode: 'edit',
      name: 'Kibble',
      brand: 'Acme',
      category: 'dry',
      baseUnit: 'g',
      packageSize: '12',
      packageUnit: 'lb',
      startingPackages: '',
    });
  });

  it('round-trips: saving the prefilled form leaves the package amount unchanged', () => {
    for (const [packageAmount, packageLabel] of [
      [5443, '12 lb'],
      [156, '5.5 oz'],
      [390, '13.2 fl oz'],
      [1, '1 ct'],
    ] as const) {
      const baseUnit = packageLabel.endsWith('fl oz') ? 'ml' : packageLabel.endsWith('ct') ? 'count' : 'g';
      const values = productFormValues(
        { name: 'X', brand: '', category: 'dry', baseUnit, packageAmount, packageLabel },
        'lb',
      );
      const result = validateProductForm(values);
      expect(result.ok && result.fields.packageAmount).toBe(packageAmount);
    }
  });

  it("falls back to the household's default unit when the label isn't recognised", () => {
    const values = productFormValues(
      { name: 'X', brand: '', category: 'dry', baseUnit: 'g', packageAmount: 2000, packageLabel: 'big bag' },
      'kg',
    );
    expect(values.packageUnit).toBe('kg');
    expect(values.packageSize).toBe('2');
  });
});
