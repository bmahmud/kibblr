import { eventSchema } from '@kibblr/core';
import type { StockEvent, WithId } from '@kibblr/core';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type { QueryConstraint, Unsubscribe } from 'firebase/firestore';

import { zodConverter } from '../converters';
import { db } from '../init';

const eventConverter = zodConverter(eventSchema);

export const eventsPath = (householdId: string) => collection(db, 'households', householdId, 'events');

/**
 * Live events, newest first. With a product id this uses the
 * `productId ASC, createdAt DESC` composite index (firestore.indexes.json).
 */
export function watchEvents(
  householdId: string,
  options: { productId?: string | null; max: number },
  onNext: (events: WithId<StockEvent>[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const constraints: QueryConstraint[] = [];
  if (options.productId) {
    constraints.push(where('productId', '==', options.productId));
  }
  constraints.push(orderBy('createdAt', 'desc'), limit(options.max));

  const q = query(eventsPath(householdId), ...constraints).withConverter(eventConverter);
  return onSnapshot(
    q,
    (snapshot) => {
      const events: WithId<StockEvent>[] = [];
      for (const document of snapshot.docs) {
        try {
          events.push(document.data());
        } catch (error) {
          console.warn(`Skipping event ${document.id}: it does not match the schema.`, error);
        }
      }
      onNext(events);
    },
    onError,
  );
}
