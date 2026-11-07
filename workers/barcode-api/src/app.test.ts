import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app';
import { bearerToken } from './auth';
import { HIT_TTL_SECONDS, MISS_TTL_SECONDS } from './cache';
import type { Env, KeyValueStore } from './env';
import opff from './fixtures/openpetfoodfacts-fancy-feast.json';
import upc from './fixtures/upcitemdb-fancy-feast.json';
import { defaultUpstreams } from './upstreams';

const PROJECT = 'kibblr';
const GTIN = '0050000429745';

let keys: JWTVerifyGetKey;
let privateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256' };
  keys = createLocalJWKSet({ keys: [jwk] });
});

function token(claims: { iss?: string; aud?: string; sub?: string; exp?: number } = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(claims.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(claims.aud ?? PROJECT)
    .setSubject(claims.sub ?? 'user-1')
    .setIssuedAt(now - 60)
    .setExpirationTime(claims.exp ?? now + 3600)
    .sign(privateKey);
}

class MemoryStore implements KeyValueStore {
  values = new Map<string, string>();
  ttls = new Map<string, number>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async put(key: string, value: string, options: { expirationTtl: number }) {
    this.values.set(key, value);
    this.ttls.set(key, options.expirationTtl);
  }
}

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const NOT_FOUND = () => json({ status: 0, status_verbose: 'product not found' }, 404);

let store: MemoryStore;
let routes: Record<string, Route>;
let calls: string[];
let env: Env;

function app(timeoutMs = 3000) {
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url.hostname);
    const route = routes[url.hostname];
    if (!route) {
      throw new Error(`unexpected fetch to ${url.hostname}`);
    }
    return route(url, init);
  });
  return createApp({ keys, upstreams: defaultUpstreams, fetch: fetchStub, timeoutMs });
}

async function get(path: string, auth?: string) {
  const headers: Record<string, string> = {};
  if (auth !== undefined) {
    headers.Authorization = auth;
  }
  return app().request(path, { headers }, env);
}

beforeEach(() => {
  store = new MemoryStore();
  calls = [];
  env = { BARCODE_CACHE: store, FIREBASE_PROJECT_ID: PROJECT };
  routes = {
    'world.openpetfoodfacts.org': () => json(opff),
    'world.openfoodfacts.org': NOT_FOUND,
    'api.upcitemdb.com': () => json({ code: 'OK', total: 0, items: [] }),
  };
});

describe('bearerToken', () => {
  it('reads the token from the header', () => {
    expect(bearerToken('Bearer abc.def')).toBe('abc.def');
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});

describe('GET /health', () => {
  it('answers without a token', async () => {
    const response = await app().request('/health', {}, env);
    expect(response.status).toBe(200);
  });
});

describe('auth', () => {
  it('rejects a missing header', async () => {
    expect((await get(`/v1/barcode/${GTIN}`)).status).toBe(401);
  });

  it('rejects a token for another project, from another issuer, expired or unsigned', async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    for (const bad of [
      await token({ aud: 'someone-else' }),
      await token({ iss: 'https://securetoken.google.com/someone-else' }),
      await token({ exp: past }),
      'not-a-jwt',
    ]) {
      expect((await get(`/v1/barcode/${GTIN}`, `Bearer ${bad}`)).status).toBe(401);
    }
    expect(calls).toEqual([]);
  });

  it('rejects an invalid code with 400 once signed in', async () => {
    const response = await get('/v1/barcode/4006381333932', `Bearer ${await token()}`);
    expect(response.status).toBe(400);
  });
});

describe('lookup', () => {
  it('answers from the first upstream, then from cache', async () => {
    const auth = `Bearer ${await token()}`;
    const first = await get(`/v1/barcode/${GTIN}`, auth);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      barcode: GTIN,
      name: 'Tender Beef & Chicken Feast Classic Pate',
      brand: 'Fancy Feast',
      source: 'openpetfoodfacts',
      cached: false,
    });
    expect(store.ttls.get(`bc:${GTIN}`)).toBe(HIT_TTL_SECONDS);

    const second = await get(`/v1/barcode/${GTIN}`, auth);
    expect(await second.json()).toMatchObject({ name: 'Tender Beef & Chicken Feast Classic Pate', cached: true });
    expect(calls).toEqual(['world.openpetfoodfacts.org']);
  });

  it('normalizes the code, so UPC-A and GTIN-13 share a cache entry', async () => {
    const auth = `Bearer ${await token()}`;
    await get('/v1/barcode/050000429745', auth);
    await get(`/v1/barcode/${GTIN}`, auth);
    expect(calls).toHaveLength(1);
  });

  it('falls through to the next upstream in order', async () => {
    routes['world.openpetfoodfacts.org'] = NOT_FOUND;
    routes['api.upcitemdb.com'] = () => json(upc);
    const response = await get(`/v1/barcode/${GTIN}`, `Bearer ${await token()}`);
    expect(await response.json()).toMatchObject({ source: 'upcitemdb', brand: 'Fancy Feast' });
    expect(calls).toEqual(['world.openpetfoodfacts.org', 'world.openfoodfacts.org', 'api.upcitemdb.com']);
  });

  it('caches a miss for a day when every upstream says not found', async () => {
    routes['world.openpetfoodfacts.org'] = NOT_FOUND;
    const auth = `Bearer ${await token()}`;
    expect((await get(`/v1/barcode/${GTIN}`, auth)).status).toBe(404);
    expect(store.ttls.get(`bc:${GTIN}`)).toBe(MISS_TTL_SECONDS);
    expect((await get(`/v1/barcode/${GTIN}`, auth)).status).toBe(404);
    expect(calls).toHaveLength(3);
  });

  it('answers 502 and caches nothing when an upstream fails and none found it', async () => {
    routes['world.openpetfoodfacts.org'] = NOT_FOUND;
    routes['api.upcitemdb.com'] = () => json({ code: 'TOO_FAST' }, 429);
    expect((await get(`/v1/barcode/${GTIN}`, `Bearer ${await token()}`)).status).toBe(502);
    expect(store.values.size).toBe(0);
  });

  it('gives up on a slow upstream and moves on', async () => {
    routes['world.openpetfoodfacts.org'] = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    routes['world.openfoodfacts.org'] = () => json({ ...opff, code: GTIN });
    const response = await app(20).request(
      `/v1/barcode/${GTIN}`,
      { headers: { Authorization: `Bearer ${await token()}` } },
      env,
    );
    expect(await response.json()).toMatchObject({ source: 'openfoodfacts' });
  });

  it('sends the User-Agent Open Food Facts asks for', async () => {
    let agent: string | null = null;
    routes['world.openpetfoodfacts.org'] = (_url, init) => {
      agent = new Headers(init?.headers).get('User-Agent');
      return json(opff);
    };
    await get(`/v1/barcode/${GTIN}`, `Bearer ${await token()}`);
    expect(agent).toMatch(/^Kibblr\//);
  });

  it('answers 429 when the rate limiter says no', async () => {
    env.LOOKUP_LIMITER = { limit: async () => ({ success: false }) };
    expect((await get(`/v1/barcode/${GTIN}`, `Bearer ${await token()}`)).status).toBe(429);
    expect(calls).toEqual([]);
  });

  it('ignores a corrupt cache entry', async () => {
    store.values.set(`bc:${GTIN}`, '{not json');
    const response = await get(`/v1/barcode/${GTIN}`, `Bearer ${await token()}`);
    expect(await response.json()).toMatchObject({ cached: false });
  });
});
