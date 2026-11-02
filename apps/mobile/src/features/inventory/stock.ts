import type { EventMethod } from '@kibblr/core';

import { runStockTransaction } from '@/firebase/repositories/stock';
import type { StockWriteResult } from '@/firebase/repositories/stock';

export type StockContext = { householdId: string; uid: string };

export type ApplyStockChangeInput = {
  productId: string;
  /** Signed, in the product's base unit. Removing more than is on hand clamps to 0. */
  delta: number;
  method: EventMethod;
  petId?: string | null;
  note?: string | null;
};

export type StockChangeResult = StockWriteResult & {
  before: number;
  after: number;
};

function withSummary(result: StockWriteResult): StockChangeResult {
  // Phase 6: call rescheduleLowStockNotification(product) here, after commit (spec section 5.3 step 4).
  return { ...result, before: result.change.before, after: result.change.after };
}

/**
 * Every stock change goes through here (spec section 5.3, D4). Returns
 * before / after / eventId so the UI can offer Undo, which calls this again
 * with the inverse of `change.applied`, the same method and note "undo".
 */
export async function applyStockChange(ctx: StockContext, input: ApplyStockChangeInput): Promise<StockChangeResult> {
  const result = await runStockTransaction({
    ...ctx,
    kind: 'delta',
    productId: input.productId,
    delta: input.delta,
    method: input.method,
    petId: input.petId ?? null,
    note: input.note ?? null,
  });
  return withSummary(result);
}

/** Sets on hand to a counted amount, recorded as an `adjust` event. */
export async function setOnHand(
  ctx: StockContext,
  input: { productId: string; target: number; note?: string | null },
): Promise<StockChangeResult> {
  const result = await runStockTransaction({
    ...ctx,
    kind: 'set',
    productId: input.productId,
    target: input.target,
    method: 'manual',
    petId: null,
    note: input.note ?? null,
  });
  return withSummary(result);
}
