import { writeBatch } from 'firebase/firestore';
import type { DocumentReference, UpdateData, DocumentData } from 'firebase/firestore';

import { db } from '../init';

/** One write in a chunked batch. */
export type BatchOp =
  | { kind: 'delete'; ref: DocumentReference }
  | { kind: 'update'; ref: DocumentReference; data: UpdateData<DocumentData> };

/** Firestore's limit per batch. */
const BATCH_MAX = 500;

/**
 * Commits writes in batches of at most 500, in order. Each batch is atomic;
 * the whole list is not, so callers order writes so a partial run is safe to retry.
 */
export async function commitInChunks(ops: readonly BatchOp[]): Promise<void> {
  for (let start = 0; start < ops.length; start += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const op of ops.slice(start, start + BATCH_MAX)) {
      if (op.kind === 'delete') {
        batch.delete(op.ref);
      } else {
        batch.update(op.ref, op.data);
      }
    }
    await batch.commit();
  }
}
