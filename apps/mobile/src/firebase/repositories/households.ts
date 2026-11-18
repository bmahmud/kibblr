import { householdSchema, newHousehold, userDocSchema } from '@kibblr/core';
import type { Household, HouseholdSettings, WithId } from '@kibblr/core';
import { collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { zodConverter } from '../converters';
import { db } from '../init';
import { commitInChunks } from './batch';
import type { BatchOp } from './batch';

const householdConverter = zodConverter(householdSchema);
const userConverter = zodConverter(userDocSchema);

/**
 * Returns the user's household id, creating the household on first sign-in.
 * One transaction reads `users/{uid}` and, only if it is missing, writes the
 * household and the pointer together, so a crash or a double call can never
 * leave an orphaned or second household.
 */
export async function bootstrapHousehold(uid: string): Promise<string> {
  const userRef = doc(db, 'users', uid).withConverter(userConverter);

  return runTransaction(db, async (tx) => {
    const existing = await tx.get(userRef);
    const pointer = existing.exists() ? existing.data() : null;
    if (pointer) {
      return pointer.householdId;
    }

    const householdRef = doc(collection(db, 'households'));
    tx.set(householdRef, { ...newHousehold(uid), createdAt: serverTimestamp() });
    tx.set(doc(db, 'users', uid), { householdId: householdRef.id });
    return householdRef.id;
  });
}

/** Live household document; `onNext(null)` if it does not exist or is not readable. */
export function watchHousehold(
  householdId: string,
  onNext: (household: WithId<Household> | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = doc(db, 'households', householdId).withConverter(householdConverter);
  return onSnapshot(
    ref,
    (snapshot) => {
      try {
        onNext(snapshot.exists() ? snapshot.data() : null);
      } catch (error) {
        // Schema mismatch: surface it rather than render half-valid data.
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    },
    onError,
  );
}

/** Changes some household settings, leaving the others as they are. */
export async function updateHouseholdSettings(householdId: string, patch: Partial<HouseholdSettings>): Promise<void> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    fields[`settings.${key}`] = value;
  }
  await updateDoc(doc(db, 'households', householdId), fields);
}

/**
 * Deletes everything in a household and the user's pointer to it (account
 * deletion). Order matters for the rules: subcollections first, while the
 * user is still a member; then the household; then `users/{uid}`. A run cut
 * short leaves a smaller household that the next attempt finishes.
 */
export async function deleteHouseholdData(householdId: string, uid: string): Promise<void> {
  const household = doc(db, 'households', householdId);
  const ops: BatchOp[] = [];
  const products = await getDocs(collection(household, 'products'));
  for (const product of products.docs) {
    const ratings = await getDocs(collection(product.ref, 'ratings'));
    ops.push(...ratings.docs.map((rating): BatchOp => ({ kind: 'delete', ref: rating.ref })));
  }
  ops.push(...products.docs.map((product): BatchOp => ({ kind: 'delete', ref: product.ref })));
  for (const name of ['pets', 'events']) {
    const snapshot = await getDocs(collection(household, name));
    ops.push(...snapshot.docs.map((item): BatchOp => ({ kind: 'delete', ref: item.ref })));
  }
  await commitInChunks(ops);
  await commitInChunks([
    { kind: 'delete', ref: household },
    { kind: 'delete', ref: doc(db, 'users', uid) },
  ]);
}
