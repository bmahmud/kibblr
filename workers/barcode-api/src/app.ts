import { normalizeGtin } from '@kibblr/core';
import type { BarcodeLookup } from '@kibblr/core';
import { Hono } from 'hono';
import type { JWTVerifyGetKey } from 'jose';

import { bearerToken, verifyFirebaseToken } from './auth';
import { readCache, writeCache } from './cache';
import type { Env } from './env';
import { lookUp } from './upstreams';
import type { Upstream } from './upstreams/types';

export type AppDeps = {
  /** Keys that sign Firebase ID tokens: Google's in production, a local set in tests. */
  keys: JWTVerifyGetKey;
  upstreams: (env: Env) => Upstream[];
  fetch: typeof fetch;
  /** Per upstream call (spec section 7.2). */
  timeoutMs?: number;
};

function log(entry: Record<string, unknown>) {
  console.log(JSON.stringify(entry));
}

/** The barcode lookup API (spec section 7.1). */
export function createApp({ keys, upstreams, fetch, timeoutMs = 3000 }: AppDeps) {
  const app = new Hono<{ Bindings: Env }>();

  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/v1/barcode/:code', async (c) => {
    const token = bearerToken(c.req.header('Authorization'));
    const uid = token ? await verifyFirebaseToken(token, c.env.FIREBASE_PROJECT_ID, keys) : null;
    if (uid === null) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    const gtin = normalizeGtin(c.req.param('code'));
    if (gtin === null) {
      return c.json({ error: 'invalid_code' }, 400);
    }

    if (c.env.LOOKUP_LIMITER && !(await c.env.LOOKUP_LIMITER.limit({ key: uid })).success) {
      return c.json({ error: 'rate_limited' }, 429);
    }

    const cached = await readCache(c.env.BARCODE_CACHE, gtin);
    if (cached) {
      log({ gtin, cached: true, found: cached.found });
      if (!cached.found) {
        return c.json({ error: 'not_found' }, 404);
      }
      const body: BarcodeLookup = { ...cached.product, cached: true };
      return c.json(body);
    }

    const result = await lookUp(gtin, upstreams(c.env), { fetch, timeoutMs });
    if (result.status === 'error') {
      log({ gtin, cached: false, found: false, failures: result.failures });
      return c.json({ error: 'upstream_failed' }, 502);
    }
    if (result.status === 'miss') {
      log({ gtin, cached: false, found: false });
      await writeCache(c.env.BARCODE_CACHE, gtin, { found: false });
      return c.json({ error: 'not_found' }, 404);
    }
    log({ gtin, cached: false, found: true, source: result.product.source });
    await writeCache(c.env.BARCODE_CACHE, gtin, { found: true, product: result.product });
    const body: BarcodeLookup = { ...result.product, cached: false };
    return c.json(body);
  });

  return app;
}
