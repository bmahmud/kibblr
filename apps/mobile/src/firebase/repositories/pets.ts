import { petSchema } from '@kibblr/core';
import type { Pet, PetDraft, PetFields, WithId } from '@kibblr/core';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { zodConverter } from '../converters';
import { db } from '../init';

const petConverter = zodConverter(petSchema);

export const petsPath = (householdId: string) => collection(db, 'households', householdId, 'pets');
const petPath = (householdId: string, petId: string) => doc(db, 'households', householdId, 'pets', petId);

/**
 * Live list of every pet, archived ones too: old ratings still need their
 * names. A document that fails the schema is skipped, not fatal.
 */
export function watchPets(
  householdId: string,
  onNext: (pets: WithId<Pet>[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(petsPath(householdId)).withConverter(petConverter),
    (snapshot) => {
      const pets: WithId<Pet>[] = [];
      for (const document of snapshot.docs) {
        try {
          pets.push(document.data());
        } catch (error) {
          console.warn(`Skipping pet ${document.id}: it does not match the schema.`, error);
        }
      }
      onNext(pets);
    },
    onError,
  );
}

export async function createPet(householdId: string, draft: PetDraft): Promise<string> {
  const ref = await addDoc(petsPath(householdId), { ...draft, createdAt: serverTimestamp() });
  return ref.id;
}

export function updatePet(householdId: string, petId: string, fields: PetFields): Promise<void> {
  return updateDoc(petPath(householdId, petId), fields);
}

/** Pets are archived, never deleted (spec section 6.7). */
export function setPetArchived(householdId: string, petId: string, archived: boolean): Promise<void> {
  return updateDoc(petPath(householdId, petId), { archived });
}
