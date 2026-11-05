import { barcodeLookupSchema } from '@kibblr/core';
import { z } from 'zod';

import type { KeyValueStore } from './env';
import type { Found } from './upstreams/types';

/** Hits are kept 30 days and misses 1 day (spec section 7.2). */
export const HIT_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MISS_TTL_SECONDS = 24 * 60 * 60;

const entrySchema = z.union([
  z.object({ found: z.literal(true), product: barcodeLookupSchema.omit({ cached: true }) }),
  z.object({ found: z.literal(false) }),
]);

export type CacheEntry = { found: true; product: Found } | { found: false };

function key(gtin: string): string {
  return `bc:${gtin}`;
}

/** The cached answer for a GTIN-13, or null when there is none (or it can't be read). */
export async function readCache(store: KeyValueStore, gtin: string): Promise<CacheEntry | null> {
  try {
    const raw = await store.get(key(gtin));
    if (raw === null) {
      return null;
    }
    const parsed = entrySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Caching is best effort: a failed write only means the next scan looks it up again. */
export async function writeCache(store: KeyValueStore, gtin: string, entry: CacheEntry): Promise<void> {
  try {
    await store.put(key(gtin), JSON.stringify(entry), {
      expirationTtl: entry.found ? HIT_TTL_SECONDS : MISS_TTL_SECONDS,
    });
  } catch {
    // Ignored on purpose.
  }
}
