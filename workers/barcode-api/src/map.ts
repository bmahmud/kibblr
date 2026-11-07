import { BRAND_MAX, NAME_MAX, parseSizeText, roundBase } from '@kibblr/core';
import type { Category, Container, LookupSource, Size } from '@kibblr/core';
import { z } from 'zod';

import type { Found } from './upstreams/types';

/** Lower case, no accents, tag punctuation as spaces: "en:Wet-Cat-Food" → "en wet cat food". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-_:]/g, ' ');
}

/** Checked in order: a "supplement chew" is a supplement, a "pate in gravy" is pate. */
const CATEGORY_WORDS: readonly [RegExp, Category][] = [
  [/\b(supplements?|vitamins?|probiotics?)\b/, 'supplement'],
  [/\b(treats?|snacks?|chews?|jerky|biscuits?|dental)\b/, 'treat'],
  [/\b(pate|terrine|mousse)\b/, 'pate'],
  [/\b(dry|kibble)\b/, 'dry'],
  [/\b(wet|gravy|canned|sauce|broth|jelly|aspic|morsels|chunks|flaked|stew|loaf)\b/, 'wet'],
];

const CONTAINER_WORDS: readonly [RegExp, Container][] = [
  [/\b(cans?|canned|tins?)\b/, 'can'],
  [/\bpouch(es)?\b/, 'pouch'],
  [/\b(trays?|cups?)\b/, 'tray'],
  [/\bbags?\b/, 'bag'],
  [/\b(box(es)?|cartons?)\b/, 'box'],
  [/\btubs?\b/, 'tub'],
  [/\bbottles?\b/, 'bottle'],
];

function firstMatch<T>(text: string, table: readonly [RegExp, T][]): T | undefined {
  const normalized = normalize(text);
  return table.find(([pattern]) => pattern.test(normalized))?.[1];
}

/** A best guess at the type from a name and category text; undefined when unsure. */
export function guessCategory(text: string): Category | undefined {
  return firstMatch(text, CATEGORY_WORDS);
}

/** A best guess at the package from a name or packaging tags; undefined when unsure. */
export function guessContainer(text: string): Container | undefined {
  return firstMatch(text, CONTAINER_WORDS);
}

function squeeze(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TRAILING_SIZE = /[\s,\-–]+\d+(?:[.,]\d+)?\s*(?:fl\.?\s*oz|oz|lbs?|kg|g|ml|l)\.?$/i;

/**
 * A product name without the brand in front (the list shows the brand
 * separately), a trailing size, or extra spaces, cut at a word to fit.
 * "Purina Fancy Feast Salmon Feast - 3oz" with brand "Fancy Feast" → "Salmon Feast".
 */
export function cleanName(name: string, brand: string): string {
  let cleaned = squeeze(name).replace(TRAILING_SIZE, '');
  if (brand) {
    // Up to two words (a maker such as "Purina") may come before the brand.
    const front = new RegExp(`^(?:\\S+\\s+){0,2}?${escapeRegExp(brand)}[\\s\\-–:,·]+`, 'i');
    const rest = cleaned.replace(front, '');
    if (rest) {
      cleaned = rest;
    }
  }
  cleaned = squeeze(cleaned);
  if (cleaned.length > NAME_MAX) {
    const cut = cleaned.slice(0, NAME_MAX + 1);
    cleaned = cut.slice(0, cut.lastIndexOf(' ')).trim();
  }
  return cleaned;
}

function cleanBrand(brands: string | undefined): string {
  return squeeze(brands?.split(',')[0] ?? '').slice(0, BRAND_MAX);
}

function httpsUrl(url: string | undefined): string | undefined {
  return url?.startsWith('https://') ? url : undefined;
}

/** Drops undefined keys, so results compare and serialize cleanly. */
function compact(found: Found): Found {
  return Object.fromEntries(Object.entries(found).filter(([, value]) => value !== undefined)) as Found;
}

// Upstream data is crowd-sourced: a field of the wrong type is ignored, not fatal.
const text = z.string().optional().catch(undefined);
const tags = z.array(z.string()).optional().catch(undefined);

const openFactsProductSchema = z.object({
  product_name: text,
  brands: text,
  quantity: text,
  product_quantity: z.union([z.number(), z.string()]).optional().catch(undefined),
  product_quantity_unit: text,
  categories_tags: tags,
  packaging_tags: tags,
  image_front_url: text,
});

function openFactsSize(product: z.infer<typeof openFactsProductSchema>): Size | undefined {
  const amount = Number(product.product_quantity);
  const unit = product.product_quantity_unit?.toLowerCase();
  if (Number.isFinite(amount) && amount > 0 && (unit === 'g' || unit === 'ml')) {
    return { amount: roundBase(amount), unit };
  }
  return parseSizeText(product.quantity ?? '') ?? undefined;
}

/** An Open Pet Food Facts or Open Food Facts `product` object; null when it has no name. */
export function mapOpenFacts(gtin: string, source: LookupSource, raw: unknown): Found | null {
  const parsed = openFactsProductSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const product = parsed.data;
  const brand = cleanBrand(product.brands);
  const name = cleanName(product.product_name ?? '', brand);
  if (!name) {
    return null;
  }
  const categoryText = [name, ...(product.categories_tags ?? [])].join(' ');
  return compact({
    barcode: gtin,
    name,
    brand,
    category: guessCategory(categoryText),
    container: guessContainer([name, ...(product.packaging_tags ?? [])].join(' ')),
    size: openFactsSize(product),
    imageUrl: httpsUrl(product.image_front_url),
    source,
  });
}

const upcItemSchema = z.object({
  title: text,
  brand: text,
  size: text,
  category: text,
});

/**
 * A UPCitemdb `items[]` entry; null when it has no title. Its images are
 * links to retailer sites, so they are not used.
 */
export function mapUpcItemDb(gtin: string, raw: unknown): Found | null {
  const parsed = upcItemSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const item = parsed.data;
  const brand = cleanBrand(item.brand);
  const name = cleanName(item.title ?? '', brand);
  if (!name) {
    return null;
  }
  return compact({
    barcode: gtin,
    name,
    brand,
    category: guessCategory(`${item.title ?? ''} ${item.category ?? ''}`),
    container: guessContainer(item.title ?? ''),
    size: parseSizeText(item.size ?? '') ?? parseSizeText(item.title ?? '') ?? undefined,
    source: 'upcitemdb',
  });
}
