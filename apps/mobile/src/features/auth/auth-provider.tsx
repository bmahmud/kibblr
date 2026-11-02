import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import * as authApi from '@/firebase/auth';
import type { User } from '@/firebase/auth';
import { bootstrapHousehold } from '@/firebase/repositories/households';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User; householdId: string }
  /** Signed in, but the household could not be loaded (usually offline at launch). */
  | { status: 'error'; user: User; message: string };

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  // Each auth change bumps this; a bootstrap that finishes after a newer
  // change (for example a quick sign-out) is ignored.
  const generation = useRef(0);

  const resolveHousehold = useCallback(async (user: User) => {
    const mine = ++generation.current;
    setState({ status: 'loading' });
    try {
      const householdId = await bootstrapHousehold(user.uid);
      if (mine === generation.current) {
        setState({ status: 'signedIn', user, householdId });
      }
    } catch {
      if (mine === generation.current) {
        setState({ status: 'error', user, message: "Couldn't load your household. Check your connection." });
      }
    }
  }, []);

  useEffect(() => {
    return authApi.watchAuthState((user) => {
      if (user) {
        void resolveHousehold(user);
      } else {
        generation.current += 1;
        setState({ status: 'signedOut' });
      }
    });
  }, [resolveHousehold]);

  const retry = useCallback(() => {
    const user = authApi.currentUser();
    if (user) {
      void resolveHousehold(user);
    }
  }, [resolveHousehold]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: authApi.signIn,
      signUp: authApi.signUp,
      signOut: authApi.signOut,
      resetPassword: authApi.resetPassword,
      retry,
    }),
    [state, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}

/** For screens behind the auth gate, where a signed-in state is guaranteed. */
export function useSignedIn(): Extract<AuthState, { status: 'signedIn' }> {
  const { state } = useAuth();
  if (state.status !== 'signedIn') {
    throw new Error('useSignedIn used outside the signed-in part of the app');
  }
  return state;
}
