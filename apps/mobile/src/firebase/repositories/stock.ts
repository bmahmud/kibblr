import { autoDeductPlan, computeAdjustment, computeStockChange } from '@kibblr/core';
import type { EventMethod, Product, StockChange, WithId } from '@kibblr/core';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { db } from '../init';
import { eventsPath } from './events';
import { productConverter, productPath } from './products';

export type StockWrite = {
  householdId: string;
  uid: string;
  productId: string;
  method: EventMethod;
  petId: string | null;
  note: string | null;
} & (
  | { kind: 'delta'; delta: number }
  | { kind: 'set'; target: number }
  /** Auto-deduct: the days since `lastAutoDeductAt`, worked out inside the transaction. */
  | { kind: 'auto'; now: Date }
);

export type StockWriteResult = {
  change: StockChange;
  /** The product as read inside the transaction, before the change. */
  product: WithId<Product>;
  /** Null when nothing changed and no event was written. */
  eventId: string | null;
};

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product ${productId} does not exist.`);
    this.name = 'ProductNotFoundError';
  }
}

/**
 * The only code that writes `onHand` (spec section 5.3, D4). One transaction
 * reads the product, computes the clamped change, updates the product and
 * appends the event, so stock and ledger can never disagree.
 *
 * Transactions need the server: offline, this rejects with code 'unavailable'
 * instead of queueing.
 */
export function runStockTransaction(write: StockWrite): Promise<StockWriteResult> {
  const { householdId, productId } = write;
  const ref = productPath(householdId, productId);

  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref.withConverter(productConverter));
    if (!snapshot.exists()) {
      throw new ProductNotFoundError(productId);
    }
    const product = snapshot.data();

    // Auto-deduct reads its plan here, against the product as read in the
    // transaction, and moves `lastAutoDeductAt` in the same commit: a second
    // phone or a second foreground sees the new mark and deducts nothing.
    const plan = write.kind === 'auto' ? autoDeductPlan(product, write.now) : null;
    const change =
      write.kind === 'delta'
        ? computeStockChange({ onHand: product.onHand, delta: write.delta })
        : write.kind === 'set'
          ? computeAdjustment({ onHand: product.onHand, target: write.target })
          : computeStockChange({ onHand: product.onHand, delta: plan?.delta ?? 0 });
    const mark = plan ? { lastAutoDeductAt: plan.nextAt } : {};
    const note = plan ? `${String(plan.days)} ${plan.days === 1 ? 'day' : 'days'}` : write.note;

    if (change.type === null) {
      if (plan) {
        tx.update(ref, mark);
      }
      return { change, product, eventId: null };
    }

    const eventRef = doc(eventsPath(householdId));
    tx.update(ref, { onHand: change.after, ...mark, updatedAt: serverTimestamp() });
    tx.set(eventRef, {
      productId,
      petId: write.petId,
      type: change.type,
      method: write.method,
      delta: change.applied,
      onHandAfter: change.after,
      note,
      createdAt: serverTimestamp(),
      createdBy: write.uid,
    });
    return { change, product, eventId: eventRef.id };
  });
}
