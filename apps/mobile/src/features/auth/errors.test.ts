import { authErrorMessage } from './errors';

describe('authErrorMessage', () => {
  it.each([
    ['auth/invalid-credential', 'Email or password is incorrect.'],
    ['auth/wrong-password', 'Email or password is incorrect.'],
    ['auth/user-not-found', 'Email or password is incorrect.'],
    ['auth/email-already-in-use', 'An account with this email already exists. Sign in instead.'],
    ['auth/invalid-email', 'Enter a valid email address.'],
    ['auth/weak-password', 'Choose a stronger password.'],
    ['auth/too-many-requests', 'Too many attempts. Wait a few minutes and try again.'],
    ['auth/network-request-failed', 'No connection. Check your network and try again.'],
    ['auth/user-disabled', 'This account has been disabled.'],
  ])('maps %s', (code, message) => {
    expect(authErrorMessage({ code, message: 'Firebase: raw text' })).toBe(message);
  });

  it('falls back to a generic message for unknown codes', () => {
    expect(authErrorMessage({ code: 'auth/something-new' })).toBe('Something went wrong. Please try again.');
  });

  it('handles values that are not Firebase errors', () => {
    expect(authErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
    expect(authErrorMessage('nope')).toBe('Something went wrong. Please try again.');
    expect(authErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});
