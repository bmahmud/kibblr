import type { Env } from '../env';
import { openFacts } from './openfacts';
import type { Found, Upstream, UpstreamContext } from './types';
import { upcItemDb } from './upcitemdb';

/** In the spec's order (section 7.2). */
export function defaultUpstreams(env: Env): Upstream[] {
  return [
    openFacts('openpetfoodfacts', 'world.openpetfoodfacts.org'),
    openFacts('openfoodfacts', 'world.openfoodfacts.org'),
    upcItemDb(env.UPCITEMDB_KEY),
  ];
}

/**
 * Asks each upstream in turn and stops at the first hit. `miss` only when
 * every upstream said "not found"; if any failed, it is `error`, so a
 * temporary outage is not cached as a miss.
 */
export async function lookUp(
  gtin: string,
  upstreams: readonly Upstream[],
  context: UpstreamContext,
): Promise<{ status: 'hit'; product: Found } | { status: 'miss' } | { status: 'error'; failures: string[] }> {
  const failures: string[] = [];
  for (const upstream of upstreams) {
    const result = await upstream.lookup(gtin, context);
    if (result.status === 'hit') {
      return result;
    }
    if (result.status === 'error') {
      failures.push(`${upstream.source}: ${result.reason}`);
    }
  }
  return failures.length > 0 ? { status: 'error', failures } : { status: 'miss' };
}
