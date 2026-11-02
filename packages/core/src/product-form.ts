import type { Category, Product } from './schemas';
import {
  DISPLAY_UNITS,
  UNIT_LABELS,
  baseUnitOf,
  defaultInputUnit,
  formatNumber,
  fromBase,
  parseNumber,
  roundBase,
  toBase,
} from './units';
import type { BaseUnit, DisplayUnit } from './units';

/** Raw text from the New / Edit product form. */
export type ProductFormInput = {
  mode: 'create' | 'edit';
  name: string;
  brand: string;
  category: Category;
  baseUnit: BaseUnit;
  packageSize: string;
  packageUnit: DisplayUnit;
  /** Create only: packages on hand right now. Empty means 0. */
  startingPackages: string;
};

export type ProductFormErrors = Partial<Record<'name' | 'brand' | 'packageSize' | 'startingPackages', string>>;

/** The fields the form edits. */
export type ProductFields = Pick<Product, 'name' | 'brand' | 'category' | 'baseUnit' | 'packageAmount' | 'packageLabel'>;

export type ProductFormResult =
  | { ok: true; fields: ProductFields; startingAmount: number }
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

  let packageAmount = 0;
  const size = parseNumber(input.packageSize);
  if (baseUnitOf(input.packageUnit) !== input.baseUnit) {
    errors.packageSize = 'Pick a unit for the package size.';
  } else if (!input.packageSize.trim()) {
    errors.packageSize = 'Enter the package size.';
  } else if (size === null) {
    errors.packageSize = 'Enter a number, like 12 or 5.5.';
  } else {
    packageAmount = toBase(size, input.packageUnit);
    if (packageAmount <= 0) {
      errors.packageSize = 'The package size must be more than 0.';
    }
  }

  let packages = 0;
  if (input.mode === 'create' && input.startingPackages.trim()) {
    const parsed = parseNumber(input.startingPackages);
    if (parsed === null) {
      errors.startingPackages = 'Enter 0 or more packages.';
    } else {
      packages = parsed;
    }
  }

  if (Object.keys(errors).length > 0 || size === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    fields: {
      name,
      brand,
      category: input.category,
      baseUnit: input.baseUnit,
      packageAmount,
      packageLabel: `${formatNumber(size)} ${UNIT_LABELS[input.packageUnit]}`,
    },
    startingAmount: roundBase(packages * packageAmount, input.baseUnit),
  };
}

/** A new manual product: the form's fields plus the spec's defaults. Stock and timestamps are set on write. */
export type ProductDraft = Omit<Product, 'onHand' | 'createdAt' | 'updatedAt'>;

export function newProductDraft(fields: ProductFields): ProductDraft {
  return {
    ...fields,
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
  };
}

/**
 * The edit form's starting values. The unit comes from the label the product
 * was saved with ("12 lb"), so it reopens the way it was entered.
 */
export function productFormValues(product: ProductFields, preferred: 'lb' | 'kg'): ProductFormInput {
  const fromLabel = DISPLAY_UNITS[product.baseUnit].find((unit) =>
    product.packageLabel.endsWith(` ${UNIT_LABELS[unit]}`),
  );
  const unit = fromLabel ?? defaultInputUnit(product.baseUnit, preferred);
  return {
    mode: 'edit',
    name: product.name,
    brand: product.brand,
    category: product.category,
    baseUnit: product.baseUnit,
    packageSize: formatNumber(fromBase(product.packageAmount, unit)),
    packageUnit: unit,
    startingPackages: '',
  };
}
