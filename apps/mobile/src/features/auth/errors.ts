const INCORRECT = 'Email or password is incorrect.';
const GENERIC = 'Something went wrong. Please try again.';

// Firebase merges wrong-password and unknown-user into invalid-credential when
// email enumeration protection is on; the older codes map to the same text.
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': INCORRECT,
  'auth/wrong-password': INCORRECT,
  'auth/user-not-found': INCORRECT,
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a stronger password.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your network and try again.',
  'auth/user-disabled': 'This account has been disabled.',
};

/** A readable message for an error thrown by Firebase Auth. */
export function authErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return MESSAGES[error.code] ?? GENERIC;
  }
  return GENERIC;
}
