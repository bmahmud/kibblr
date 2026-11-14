import { z } from 'zod';

import { defaultContainer } from './count';
import { productFormValues } from './product-form';
import type { ProductFormInput } from './product-form';
import { BRAND_MAX, CATEGORIES, CONTAINERS, NAME_MAX, sizeSchema } from './schemas';

/** The databases the barcode Worker asks, in order (spec section 7.2). */
export const LOOKUP_SOURCES = ['openpetfoodfacts', 'openfoodfacts', 'upcitemdb'] as const;
export type LookupSource = (typeof LOOKUP_SOURCES)[number];

export const LOOKUP_SOURCE_LABELS: Record<LookupSource, string> = {
  openpetfoodfacts: 'Open Pet Food Facts',
  openfoodfacts: 'Open Food Facts',
  upcitemdb: 'UPCitemdb',
};

/**
 * The Worker's `200` body (spec section 7.1). The Worker builds it and the
 * app parses it. Everything past name and brand is a best guess and may be missing.
 */
export const barcodeLookupSchema = z.object({
  barcode: z.string().regex(/^\d{13}$/),
  name: z.string().trim().min(1).max(NAME_MAX),
  brand: z.string().trim().max(BRAND_MAX),
  category: z.enum(CATEGORIES).optional(),
  container: z.enum(CONTAINERS).optional(),
  size: sizeSchema.optional(),
  imageUrl: z.url({ protocol: /^https$/ }).optional(),
  /** Which database answered. */
  source: z.enum(LOOKUP_SOURCES),
  /** True when the Worker answered from its cache. */
  cached: z.boolean(),
});

export type BarcodeLookup = z.infer<typeof barcodeLookupSchema>;

/** New product's starting values from a lookup. Unknown type means wet; unknown package follows the type. */
export function lookupFormInput(
  lookup: BarcodeLookup,
  preferred: 'lb' | 'kg',
  startingCount: string,
): ProductFormInput {
  const category = lookup.category ?? 'wet';
  const values = productFormValues(
    {
      name: lookup.name,
      brand: lookup.brand,
      category,
      container: lookup.container ?? defaultContainer(category),
      size: lookup.size ?? null,
      petIds: [],
      reorderUrl: null,
    },
    preferred,
  );
  return { ...values, mode: 'create', startingCount };
}
