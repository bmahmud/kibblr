import { z } from 'zod';

import { mapUpcItemDb } from '../map';
import { errorReason } from './types';
import type { Upstream } from './types';

const responseSchema = z.object({ items: z.array(z.unknown()).optional() });

/**
 * UPCitemdb. With a key it uses the paid endpoint; without one, the free
 * trial endpoint, which is limited per IP address and often answers 429.
 * It reads UPC-A, so a GTIN-13's leading zero is dropped.
 */
export function upcItemDb(key: string | undefined): Upstream {
  const url = key ? 'https://api.upcitemdb.com/prod/v1/lookup' : 'https://api.upcitemdb.com/prod/trial/lookup';
  const headers: Record<string, string> = key
    ? { Accept: 'application/json', user_key: key, key_type: '3scale' }
    : { Accept: 'application/json' };
  return {
    source: 'upcitemdb',
    async lookup(gtin, { fetch, timeoutMs }) {
      const code = gtin.startsWith('0') ? gtin.slice(1) : gtin;
      try {
        const response = await fetch(`${url}?upc=${code}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
        // 400 INVALID_UPC and 404 both mean it doesn't know the code.
        if (response.status === 400 || response.status === 404) {
          return { status: 'miss' };
        }
        if (!response.ok) {
          return { status: 'error', reason: `http ${response.status}` };
        }
        const body = responseSchema.safeParse(await response.json());
        if (!body.success) {
          return { status: 'error', reason: 'bad response' };
        }
        const product = body.data.items?.[0] === undefined ? null : mapUpcItemDb(gtin, body.data.items[0]);
        return product ? { status: 'hit', product } : { status: 'miss' };
      } catch (error) {
        return { status: 'error', reason: errorReason(error) };
      }
    },
  };
}
