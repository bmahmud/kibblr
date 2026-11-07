import type { BarcodeLookup } from '@kibblr/core';

import { idToken } from '@/firebase/auth';

import { fetchBarcodeLookup } from './barcode-client';

/** The signed-in user's barcode lookup. Null when nothing was found or the Worker can't be reached. */
export async function lookupBarcode(gtin: string): Promise<BarcodeLookup | null> {
  return fetchBarcodeLookup(gtin, {
    baseUrl: process.env.EXPO_PUBLIC_API_URL,
    token: await idToken(),
  });
}
