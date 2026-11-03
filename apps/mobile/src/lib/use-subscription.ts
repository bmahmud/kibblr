import { useEffect, useEffectEvent, useState } from 'react';

type Subscribe<T> = (onNext: (data: T) => void, onError: (error: Error) => void) => () => void;

export type SubscriptionState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

/**
 * Holds the latest value from a Firestore listener. It resubscribes only when
 * `key` changes, so callers can pass an inline `subscribe`. State is tagged
 * with its key, so a stale value reads as loading after the key changes
 * (the same approach as `useHousehold`).
 */
export function useSubscription<T>(key: string, subscribe: Subscribe<T>, errorMessage: string): SubscriptionState<T> {
  const [latest, setLatest] = useState<{ key: string; state: SubscriptionState<T> } | null>(null);
  const start = useEffectEvent(() =>
    subscribe(
      (data) => setLatest({ key, state: { status: 'ready', data } }),
      (error) => {
        console.warn(errorMessage, error);
        setLatest({ key, state: { status: 'error', message: errorMessage } });
      },
    ),
  );

  useEffect(() => start(), [key]);

  return latest?.key === key ? latest.state : { status: 'loading' };
}
