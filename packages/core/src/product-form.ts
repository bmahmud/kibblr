import { roundCount } from './count';
import type { Category, Container, Product } from './schemas';
import { baseUnitOf, defaultSizeUnit, formatNumber, fromBase, parseNumber, sizeDisplayUnit, toBase } from './units';
import type { DisplayUnit } from './units';

/** Raw text from the New / Edit product form. */
export type ProductFormInput = {
  mode: 'create' | 'edit';
  name: string;
  brand: string;
  category: Category;
  container: Container;
  /** Size of one package. Optional: empty means not entered. */
  sizeValue: string;
  sizeUnit: DisplayUnit;
  /** Create only: packages on hand right now. Empty means 0. */
  startingCount: string;
};

export type ProductFormErrors = Partial<Record<'name' | 'brand' | 'size' | 'startingCount', string>>;

/** The fields the form edits. */
export type ProductFields = Pick<Product, 'name' | 'brand' | 'category' | 'container' | 'size'>;

export type ProductFormResult =
  | { ok: true; fields: ProductFields; startingCount: number }
  | { ok: false; errors: ProductFormErrors };

export function validateProductForm(input: ProductFormInput): ProductFormResult {
  const errors: ProductFormErrors = {};

  const name = input.name.trim();
  if (!name) {
    errors.name = 'Enter a name.';
  } else if (name.length > 120) {
    errors.name = 'Keep the name under 120 characters.';
  }

  const brand = input.brand.trim();
  if (brand.length > 80) {
    errors.brand = 'Keep the brand under 80 characters.';
  }

  let size: ProductFields['size'] = null;
  if (input.sizeValue.trim()) {
    const value = parseNumber(input.sizeValue);
    if (value === null) {
      errors.size = 'Enter a number, like 3 or 5.5, or leave it blank.';
    } else {
      const amount = toBase(value, input.sizeUnit);
      if (amount <= 0) {
        errors.size = 'The size must be more than 0.';
      } else {
        size = { amount, unit: baseUnitOf(input.sizeUnit) };
      }
    }
  }

  let startingCount = 0;
  if (input.mode === 'create' && input.startingCount.trim()) {
    const parsed = parseNumber(input.startingCount);
    if (parsed === null) {
      errors.startingCount = 'Enter 0 or more, like 12 or 1.5.';
    } else {
      startingCount = roundCount(parsed);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    fields: { name, brand, category: input.category, container: input.container, size },
    startingCount,
  };
}

/**
 * A new product: the form's fields plus the spec's defaults, and the GTIN-13
 * if it was scanned. Stock and timestamps are set on write.
 */
export type ProductDraft = Omit<Product, 'onHand' | 'createdAt' | 'updatedAt'>;

export function newProductDraft(fields: ProductFields, barcode: string | null = null): ProductDraft {
  return {
    ...fields,
    barcode,
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
  };
}

/**
 * The edit form's starting values. The size shows in the household's unit
 * ("3 oz"); if that rounding would change it on save, it shows in g or ml.
 */
export function productFormValues(product: ProductFields, preferred: 'lb' | 'kg'): ProductFormInput {
  let sizeValue = '';
  let sizeUnit = defaultSizeUnit(product.container, preferred);
  if (product.size) {
    const unit = sizeDisplayUnit(product.size, preferred);
    const text = formatNumber(fromBase(product.size.amount, unit));
    const exact = toBase(Number(text), unit) === product.size.amount;
    sizeUnit = exact ? unit : product.size.unit;
    sizeValue = exact ? text : String(product.size.amount);
  }
  return {
    mode: 'edit',
    name: product.name,
    brand: product.brand,
    category: product.category,
    container: product.container,
    sizeValue,
    sizeUnit,
    startingCount: '',
  };
}
