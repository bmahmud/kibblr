import type { Household, WithId } from '@kibblr/core';
import { useEffect, useState } from 'react';

import { watchHousehold } from '@/firebase/repositories/households';

import { useSignedIn } from './auth-provider';

export type HouseholdState =
  | { status: 'loading' }
  | { status: 'ready'; household: WithId<Household> }
  | { status: 'error'; message: string };

/** Live snapshot of the signed-in user's household. */
export function useHousehold(): HouseholdState {
  const { householdId } = useSignedIn();
  // Tagged with the id it belongs to, so a stale value reads as loading when
  // the household changes instead of needing a reset inside the effect.
  const [latest, setLatest] = useState<{ householdId: string; state: HouseholdState } | null>(null);

  useEffect(() => {
    return watchHousehold(
      householdId,
      (household) =>
        setLatest({
          householdId,
          state: household ? { status: 'ready', household } : { status: 'error', message: 'Household not found.' },
        }),
      () => setLatest({ householdId, state: { status: 'error', message: "Couldn't load your household." } }),
    );
  }, [householdId]);

  return latest?.householdId === householdId ? latest.state : { status: 'loading' };
}
