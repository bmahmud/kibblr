import { activePets } from '@kibblr/core';
import type { Pet, WithId } from '@kibblr/core';

import { useSignedIn } from '@/features/auth/auth-provider';
import { watchPets } from '@/firebase/repositories/pets';
import { useSubscription } from '@/lib/use-subscription';

/** Live pets, archived ones included (old ratings still name them). */
export function usePets() {
  const { householdId } = useSignedIn();
  return useSubscription<WithId<Pet>[]>(
    `pets:${householdId}`,
    (onNext, onError) => watchPets(householdId, onNext, onError),
    "Couldn't load your pets.",
  );
}

/** Pets to pick from or ask about: not archived, by name. Empty while loading. */
export function useActivePets(): WithId<Pet>[] {
  const pets = usePets();
  return pets.status === 'ready' ? activePets(pets.data) : [];
}
