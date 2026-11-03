const GENERIC = 'Something went wrong, so nothing changed. Please try again.';

const MESSAGES: Record<string, string> = {
  // Transactions need the server; the SDK rejects them offline (spec D4).
  unavailable: "You're offline, so nothing changed. Try again when you're back online.",
  'deadline-exceeded': "You're offline, so nothing changed. Try again when you're back online.",
  'permission-denied': "You don't have access to this household.",
  'not-found': 'This product no longer exists.',
  aborted: 'Someone else changed this at the same time. Please try again.',
};

/** A readable message for an error from a Firestore write or stock change. */
export function inventoryErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return GENERIC;
  }
  if ('name' in error && error.name === 'ProductNotFoundError') {
    return MESSAGES['not-found'] ?? GENERIC;
  }
  if ('code' in error && typeof error.code === 'string') {
    return MESSAGES[error.code] ?? GENERIC;
  }
  return GENERIC;
}
