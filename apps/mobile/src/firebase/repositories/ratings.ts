import { ratingSchema } from '@kibblr/core';
import type { Rating, WithId } from '@kibblr/core';
import {
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { zodConverter } from '../converters';
import { db } from '../init';
import { productPath } from './products';

const ratingConverter = zodConverter(ratingSchema);

const ratingsPath = (householdId: string, productId: string) =>
  collection(db, 'households', householdId, 'products', productId, 'ratings');

/** Live ratings of one product, newest first. A document that fails the schema is skipped. */
export function watchRatings(
  householdId: string,
  productId: string,
  options: { max: number },
  onNext: (ratings: WithId<Rating>[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(ratingsPath(householdId, productId), orderBy('createdAt', 'desc'), limit(options.max)).withConverter(
    ratingConverter,
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const ratings: WithId<Rating>[] = [];
      for (const document of snapshot.docs) {
        try {
          ratings.push(document.data());
        } catch (error) {
          console.warn(`Skipping rating ${document.id}: it does not match the schema.`, error);
        }
      }
      onNext(ratings);
    },
    onError,
  );
}

/**
 * Saves a rating and adds the pet to the product's `ratedBy` in one batch, so
 * the pet's page lists the product even when the pet isn't in `petIds`.
 */
export async function addRating(
  householdId: string,
  productId: string,
  rating: Omit<Rating, 'createdAt'>,
): Promise<string> {
  const ref = doc(ratingsPath(householdId, productId));
  const batch = writeBatch(db);
  batch.set(ref, { ...rating, createdAt: serverTimestamp() });
  batch.update(productPath(householdId, productId), {
    ratedBy: arrayUnion(rating.petId),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

/** Adds pets to `ratedBy`; for ratings saved before the field existed. */
export function markRatedBy(householdId: string, productId: string, petIds: string[]): Promise<void> {
  return updateDoc(productPath(householdId, productId), {
    ratedBy: arrayUnion(...petIds),
    updatedAt: serverTimestamp(),
  });
}
