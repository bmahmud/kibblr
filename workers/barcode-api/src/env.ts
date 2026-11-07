/** The parts of Workers KV the cache uses, so tests can pass an in-memory map. */
export type KeyValueStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
};

/** A Workers Rate Limiting binding. */
export type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

/** Bindings from `wrangler.toml` and secrets. */
export type Env = {
  BARCODE_CACHE: KeyValueStore;
  FIREBASE_PROJECT_ID: string;
  /** Optional: without it, UPCitemdb's free trial endpoint is used. */
  UPCITEMDB_KEY?: string;
  /** Optional: without it, lookups are not rate limited (spec section 7.2). */
  LOOKUP_LIMITER?: RateLimiter;
};
