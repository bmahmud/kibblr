import { ratingPromptReason } from '@kibblr/core';
import type { EventMethod, RatingPromptReason } from '@kibblr/core';
import { router } from 'expo-router';

import type { StockChangeResult } from '@/features/inventory/stock';
import { hasEarlierUse } from '@/firebase/repositories/events';

export type RatingSheetReason = RatingPromptReason | 'manual';

/**
 * `productId:reason` pairs already asked this session, so neither prompt nags
 * twice, but running out still asks after a first use did.
 */
const asked = new Set<string>();

/** Opens the rating sheet for a product (spec section 6.5), or from the product's Feedback section. */
export function openRatingSheet(productId: string, reason: RatingSheetReason, petId?: string) {
  router.push({
    pathname: '/rate/[productId]',
    params: petId ? { productId, reason, petId } : { productId, reason },
  });
}

/**
 * After a stock change: asks "How did {pet} like it?" when the product ran
 * out or was used for the first time. Never throws and never blocks the change.
 */
export async function maybePromptRating(householdId: string, result: StockChangeResult, method: EventMethod) {
  const productId = result.product.id;
  const eventId = result.eventId;
  if (eventId === null) {
    return;
  }
  // Once first use has been asked about, there's no need to query the ledger again.
  const reason = await ratingPromptReason(result.change, method, () =>
    asked.has(`${productId}:firstUse`) ? Promise.resolve(true) : hasEarlierUse(householdId, productId, eventId),
  );
  if (reason === null || asked.has(`${productId}:${reason}`)) {
    return;
  }
  asked.add(`${productId}:${reason}`);
  openRatingSheet(productId, reason);
}
