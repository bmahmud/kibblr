import { z } from 'zod';

import { mapOpenFacts } from '../map';
import { errorReason } from './types';
import type { Upstream } from './types';

/** Open Food Facts asks every app to identify itself with a name and a contact. */
export const USER_AGENT = 'Kibblr/0.1 (github.com/bmahmud/kibblr)';

const FIELDS = [
  'product_name',
  'brands',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
  'categories_tags',
  'packaging_tags',
  'image_front_url',
].join(',');

const responseSchema = z.object({ status: z.number(), product: z.unknown().optional() });

/**
 * Open Pet Food Facts and Open Food Facts share one API on different hosts.
 * "Not found" is a 404 whose body has `status: 0`.
 */
export function openFacts(source: 'openpetfoodfacts' | 'openfoodfacts', host: string): Upstream {
  return {
    source,
    async lookup(gtin, { fetch, timeoutMs }) {
      try {
        const response = await fetch(`https://${host}/api/v2/product/${gtin}.json?fields=${FIELDS}`, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok && response.status !== 404) {
          return { status: 'error', reason: `http ${response.status}` };
        }
        const body = responseSchema.safeParse(await response.json());
        if (!body.success) {
          return { status: 'error', reason: 'bad response' };
        }
        const product = body.data.status === 1 ? mapOpenFacts(gtin, source, body.data.product) : null;
        return product ? { status: 'hit', product } : { status: 'miss' };
      } catch (error) {
        return { status: 'error', reason: errorReason(error) };
      }
    },
  };
}
