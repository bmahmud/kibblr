import { z } from 'zod';

import { BASE_UNITS } from './units';

/**
 * Zod schemas for every Firestore document (spec section 5.1). They describe
 * data as read: the app converts Firestore Timestamps to Dates before parsing,
 * so this package never imports Firebase.
 */

const timestamp = z.date();
const id = z.string().min(1);
/** Stock amounts are package counts: finite, never negative. */
const amount = z.number().nonnegative();
const httpUrl = z.url({ protocol: /^https?$/ });

export const WEIGHT_UNITS = ['lb', 'kg'] as const;
export const SPECIES = ['cat', 'dog', 'other'] as const;
export const CATEGORIES = ['dry', 'wet', 'pate', 'treat', 'supplement', 'other'] as const;
export const CONTAINERS = ['can', 'pouch', 'tray', 'bag', 'box', 'tub', 'bottle', 'item'] as const;
export const VERDICTS = ['reorder', 'skip', 'undecided'] as const;
export const REACTIONS = ['loved', 'ok', 'refused'] as const;
export const EVENT_TYPES = ['add', 'remove', 'adjust'] as const;
export const EVENT_METHODS = ['scan', 'manual', 'feeding', 'auto'] as const;

export const householdSettingsSchema = z.object({
  defaultLowStockDays: z.int().min(1).max(365),
  notifyHour: z.int().min(0).max(23),
  preferredWeightUnit: z.enum(WEIGHT_UNITS),
});

export const householdSchema = z.object({
  name: z.string().trim().min(1).max(80),
  memberUids: z.array(id).min(1),
  settings: householdSettingsSchema,
  createdAt: timestamp,
});

export const userDocSchema = z.object({
  householdId: id,
});

export const petSchema = z.object({
  name: z.string().trim().min(1).max(40),
  species: z.enum(SPECIES),
  archived: z.boolean(),
  createdAt: timestamp,
});

export const lowStockRuleSchema = z.object({
  mode: z.enum(['days', 'amount']),
  value: z.number().positive(),
});

export const productSchema = z.object({
  /** Normalized GTIN-13; null for products added without a barcode. */
  barcode: z.string().regex(/^\d{13}$/).nullable(),
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80),
  category: z.enum(CATEGORIES),
  container: z.enum(CONTAINERS),
  /** Net weight or volume of one package, for display; null when not entered. */
  size: z.object({ amount: z.number().positive(), unit: z.enum(BASE_UNITS) }).nullable(),
  /** Packages on hand. */
  onHand: amount,
  /** Packages per day, all pets combined. */
  dailyUsage: z.number().positive().nullable(),
  autoDeduct: z.boolean(),
  lastAutoDeductAt: timestamp.nullable(),
  /** null means "use the household default". */
  lowStock: lowStockRuleSchema.nullable(),
  petIds: z.array(id),
  verdict: z.enum(VERDICTS),
  verdictNote: z.string().max(500).nullable(),
  reorderUrl: httpUrl.nullable(),
  imageUrl: httpUrl.nullable(),
  source: z.enum(['manual', 'lookup']),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const ratingSchema = z.object({
  petId: id,
  reaction: z.enum(REACTIONS),
  comment: z.string().max(500).nullable(),
  createdAt: timestamp,
});

export const eventSchema = z
  .object({
    productId: id,
    petId: id.nullable(),
    type: z.enum(EVENT_TYPES),
    method: z.enum(EVENT_METHODS),
    /** Signed, in packages: the change actually applied after clamping. */
    delta: z.number().refine((n) => n !== 0, 'delta must not be zero'),
    onHandAfter: amount,
    note: z.string().max(200).nullable(),
    createdAt: timestamp,
    createdBy: id,
  })
  .refine((e) => e.type === 'adjust' || (e.type === 'add' ? e.delta > 0 : e.delta < 0), {
    message: 'add events must be positive and remove events negative',
    path: ['delta'],
  });

export type WeightUnit = (typeof WEIGHT_UNITS)[number];
export type Species = (typeof SPECIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Container = (typeof CONTAINERS)[number];
export type Verdict = (typeof VERDICTS)[number];
export type Reaction = (typeof REACTIONS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type EventMethod = (typeof EVENT_METHODS)[number];

export type HouseholdSettings = z.infer<typeof householdSettingsSchema>;
export type Household = z.infer<typeof householdSchema>;
export type UserDoc = z.infer<typeof userDocSchema>;
export type Pet = z.infer<typeof petSchema>;
export type LowStockRule = z.infer<typeof lowStockRuleSchema>;
export type Product = z.infer<typeof productSchema>;
export type Rating = z.infer<typeof ratingSchema>;
export type StockEvent = z.infer<typeof eventSchema>;

/** A document as returned by a repository: its data plus its Firestore id. */
export type WithId<T> = T & { id: string };
