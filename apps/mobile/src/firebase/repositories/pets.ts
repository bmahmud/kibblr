import { petDeletePlan, petSchema } from '@kibblr/core';
import type { Pet, PetDraft, PetFields, WithId } from '@kibblr/core';
import {
  addDoc,
  arrayRemove,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { zodConverter } from '../converters';
import { db } from '../init';
import { commitInChunks } from './batch';
import type { BatchOp } from './batch';
import { getProducts, productPath } from './products';
import { readAll } from './read-all';

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

/** Archiving hides a pet but keeps it and its ratings (spec section 6.7). */
export function setPetArchived(householdId: string, petId: string, archived: boolean): Promise<void> {
  return updateDoc(petPath(householdId, petId), { archived });
}

/** Every pet, once (data export). */
export function getPets(householdId: string): Promise<WithId<Pet>[]> {
  return readAll(query(petsPath(householdId)).withConverter(petConverter), 'pet');
}

/**
 * Deletes a pet for good (spec section 6.7): its ratings, its tag on products
 * (`petIds`, `ratedBy`), then the pet. History entries keep the old `petId`
 * and show no name. The pet goes last, so a run cut short can be repeated.
 */
export async function deletePet(householdId: string, petId: string): Promise<void> {
  const plan = petDeletePlan(await getProducts(householdId), petId);
  const ops: BatchOp[] = [];
  for (const productId of plan.ratingsOn) {
    const ratings = await getDocs(
      query(collection(productPath(householdId, productId), 'ratings'), where('petId', '==', petId)),
    );
    for (const rating of ratings.docs) {
      ops.push({ kind: 'delete', ref: rating.ref });
    }
  }
  for (const productId of plan.untag) {
    ops.push({
      kind: 'update',
      ref: productPath(householdId, productId),
      data: { petIds: arrayRemove(petId), ratedBy: arrayRemove(petId), updatedAt: serverTimestamp() },
    });
  }
  ops.push({ kind: 'delete', ref: petPath(householdId, petId) });
  await commitInChunks(ops);
}
