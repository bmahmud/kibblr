import { householdSchema, newHousehold, userDocSchema } from '@kibblr/core';
import type { Household, WithId } from '@kibblr/core';
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { zodConverter } from '../converters';
import { db } from '../init';

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
