import { Timestamp } from 'firebase/firestore';
import type {
  DocumentData,
  FirestoreDataConverter,
  PartialWithFieldValue,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { WithId } from '@kibblr/core';

type Parser<T> = { parse(data: unknown): T };

/** Firestore Timestamps become Dates so the core schemas stay Firebase-free. */
function timestampsToDates(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (Array.isArray(value)) {
    return value.map(timestampsToDates);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, timestampsToDates(inner)]));
  }
  return value;
}

/**
 * Zod-parses every document read at the boundary (spec section 13).
 * Use it on refs that are read; writes go through plain refs because they
 * carry serverTimestamp() sentinels rather than Dates.
 */
export function zodConverter<T extends object>(schema: Parser<T>): FirestoreDataConverter<WithId<T>, DocumentData> {
  return {
    toFirestore(model: PartialWithFieldValue<WithId<T>>): DocumentData {
      const data: DocumentData = { ...model };
      delete data.id;
      return data;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): WithId<T> {
      // Without 'estimate', a document we just wrote reads back with
      // createdAt: null until the server confirms it, and fails the schema.
      const data = snapshot.data({ ...options, serverTimestamps: 'estimate' });
      return { ...schema.parse(timestampsToDates(data)), id: snapshot.id };
    },
  };
}
