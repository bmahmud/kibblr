import { barcodeLookupSchema } from '@kibblr/core';
import type { BarcodeLookup } from '@kibblr/core';

/** Longer than the Worker's worst case of three 3-second upstream calls, so a slow first lookup still lands in its cache. */
export const LOOKUP_TIMEOUT_MS = 10_000;

type Options = {
  baseUrl: string | undefined;
  token: string | null;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Asks the barcode Worker about a GTIN-13 (spec section 7.1). Null for "not
 * found" and for every failure: the lookup only saves typing, so it never
 * blocks a scan (spec section 6.3).
 */
export async function fetchBarcodeLookup(
  gtin: string,
  { baseUrl, token, fetch: fetcher = fetch, timeoutMs = LOOKUP_TIMEOUT_MS }: Options,
): Promise<BarcodeLookup | null> {
  if (!baseUrl || !token) {
    return null;
  }
  // A controller rather than AbortSignal.timeout, which not every React Native runtime has.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`${baseUrl.replace(/\/+$/, '')}/v1/barcode/${gtin}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const parsed = barcodeLookupSchema.safeParse(await response.json());
    return parsed.success && parsed.data.barcode === gtin ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
