import { computeAdjustment, computeStockChange } from '@kibblr/core';
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
} & ({ kind: 'delta'; delta: number } | { kind: 'set'; target: number });

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
    const change =
      write.kind === 'delta'
        ? computeStockChange({ onHand: product.onHand, delta: write.delta, baseUnit: product.baseUnit })
        : computeAdjustment({ onHand: product.onHand, target: write.target, baseUnit: product.baseUnit });

    if (change.type === null) {
      return { change, product, eventId: null };
    }

    const eventRef = doc(eventsPath(householdId));
    tx.update(ref, { onHand: change.after, updatedAt: serverTimestamp() });
    tx.set(eventRef, {
      productId,
      petId: write.petId,
      type: change.type,
      method: write.method,
      delta: change.applied,
      onHandAfter: change.after,
      note: write.note,
      createdAt: serverTimestamp(),
      createdBy: write.uid,
    });
    return { change, product, eventId: eventRef.id };
  });
}
