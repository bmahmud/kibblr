import type { BarcodeLookup, LookupSource } from '@kibblr/core';

/** What an upstream found, before the Worker says whether it came from cache. */
export type Found = Omit<BarcodeLookup, 'cached'>;

/** `miss` is a definite "not in this database"; `error` is anything else (timeout, 5xx, 429, bad JSON). */
export type UpstreamResult =
  | { status: 'hit'; product: Found }
  | { status: 'miss' }
  | { status: 'error'; reason: string };

export type UpstreamContext = {
  fetch: typeof fetch;
  /** Per upstream call (spec section 7.2: 3 seconds). */
  timeoutMs: number;
};

export type Upstream = {
  source: LookupSource;
  lookup(gtin: string, context: UpstreamContext): Promise<UpstreamResult>;
};

export function errorReason(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
