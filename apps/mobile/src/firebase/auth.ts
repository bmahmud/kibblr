import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

import { auth } from './init';

export type { User };

export function watchAuthState(onChange: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, onChange);
}

export function currentUser(): User | null {
  return auth.currentUser;
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUp(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/** A current ID token for the barcode Worker (refreshed by Firebase when needed), or null if signed out or offline. */
export async function idToken(): Promise<string | null> {
  try {
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Confirms the signed-in user's password. Firebase only deletes a login that
 * signed in recently, so account deletion asks for it first.
 */
export async function reauthenticate(password: string): Promise<User> {
  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('Not signed in.');
  }
  const result = await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  return result.user;
}

/** Deletes the login itself; the auth listener then signs the app out. */
export async function deleteLogin(user: User): Promise<void> {
  await deleteUser(user);
}
