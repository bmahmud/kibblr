import { fetchBarcodeLookup } from './barcode-client';

const GTIN = '0050000429745';
const found = {
  barcode: GTIN,
  name: 'Tender Beef & Chicken Feast Classic Pate',
  brand: 'Fancy Feast',
  category: 'pate',
  size: { amount: 85, unit: 'g' },
  source: 'openpetfoodfacts',
  cached: true,
};

function respond(body: unknown, status = 200) {
  return jest.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('fetchBarcodeLookup', () => {
  it('returns the parsed lookup, sending the token', async () => {
    const fetch = respond(found);
    const result = await fetchBarcodeLookup(GTIN, { baseUrl: 'https://api.example.dev/', token: 't0k', fetch });
    expect(result).toEqual(found);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.example.dev/v1/barcode/${GTIN}`);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer t0k' });
  });

  it('returns null without a Worker URL or a token, without calling it', async () => {
    const fetch = respond(found);
    expect(await fetchBarcodeLookup(GTIN, { baseUrl: undefined, token: 't', fetch })).toBeNull();
    expect(await fetchBarcodeLookup(GTIN, { baseUrl: 'https://x.dev', token: null, fetch })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null for not found, errors and bad bodies', async () => {
    const options = { baseUrl: 'https://x.dev', token: 't' };
    expect(await fetchBarcodeLookup(GTIN, { ...options, fetch: respond({ error: 'not_found' }, 404) })).toBeNull();
    expect(
      await fetchBarcodeLookup(GTIN, { ...options, fetch: respond({ error: 'upstream_failed' }, 502) }),
    ).toBeNull();
    expect(await fetchBarcodeLookup(GTIN, { ...options, fetch: respond({ name: 'no barcode' }) })).toBeNull();
    expect(
      await fetchBarcodeLookup(GTIN, { ...options, fetch: respond({ ...found, barcode: '4006381333931' }) }),
    ).toBeNull();
    const offline = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    expect(await fetchBarcodeLookup(GTIN, { ...options, fetch: offline })).toBeNull();
  });

  it('gives up after the timeout', async () => {
    const hang = jest.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    expect(
      await fetchBarcodeLookup(GTIN, { baseUrl: 'https://x.dev', token: 't', fetch: hang, timeoutMs: 20 }),
    ).toBeNull();
  });
});
