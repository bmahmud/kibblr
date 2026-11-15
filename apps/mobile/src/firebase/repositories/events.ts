import { eventSchema } from '@kibblr/core';
import type { StockEvent, WithId } from '@kibblr/core';
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type { QueryConstraint, Unsubscribe } from 'firebase/firestore';

import { zodConverter } from '../converters';
import { db } from '../init';
import { readAll } from './read-all';

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

/**
 * Whether the product was used before the event just written (spec section
 * 6.5, first use). Two equality filters need no composite index: Firestore
 * merges the single-field ones.
 */
export async function hasEarlierUse(householdId: string, productId: string, eventId: string): Promise<boolean> {
  const snapshot = await getDocs(
    query(eventsPath(householdId), where('productId', '==', productId), where('type', '==', 'remove'), limit(2)),
  );
  return snapshot.docs.some((document) => document.id !== eventId);
}

/**
 * Live household events since `since`, for learning usage rates (spec section
 * 8). One range filter on `createdAt`: the automatic single-field index.
 */
export function watchRecentEvents(
  householdId: string,
  since: Date,
  onNext: (events: WithId<StockEvent>[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(eventsPath(householdId), where('createdAt', '>=', since), orderBy('createdAt', 'desc')).withConverter(
    eventConverter,
  );
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

/** The whole ledger, once (data export). */
export function getEvents(householdId: string): Promise<WithId<StockEvent>[]> {
  return readAll(query(eventsPath(householdId)).withConverter(eventConverter), 'event');
}
