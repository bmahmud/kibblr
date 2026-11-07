import { ratingSchema } from '@kibblr/core';
import type { Rating, WithId } from '@kibblr/core';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { zodConverter } from '../converters';
import { db } from '../init';

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

export async function addRating(
  householdId: string,
  productId: string,
  rating: Omit<Rating, 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(ratingsPath(householdId, productId), { ...rating, createdAt: serverTimestamp() });
  return ref.id;
}
