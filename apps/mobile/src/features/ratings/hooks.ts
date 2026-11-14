import type { Rating, WithId } from '@kibblr/core';

import { useSignedIn } from '@/features/auth/auth-provider';
import { watchRatings } from '@/firebase/repositories/ratings';
import { useSubscription } from '@/lib/use-subscription';

/** Live ratings of one product, newest first. */
export function useRatings(productId: string, max = 50) {
  const { householdId } = useSignedIn();
  return useSubscription<WithId<Rating>[]>(
    `ratings:${householdId}:${productId}:${max}`,
    (onNext, onError) => watchRatings(householdId, productId, { max }, onNext, onError),
    "Couldn't load the ratings.",
  );
}
