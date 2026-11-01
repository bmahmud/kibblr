import { describe, expect, it } from 'vitest';

import { MIN_PASSWORD_LENGTH, validateCredentials } from './auth';

const good = { email: 'me@example.com', password: 'correct horse', confirm: 'correct horse' };

describe('validateCredentials (sign in)', () => {
  it('passes valid input', () => {
    expect(validateCredentials({ mode: 'signIn', ...good })).toEqual({});
  });

  it('allows surrounding whitespace on the email', () => {
    expect(validateCredentials({ mode: 'signIn', ...good, email: '  me@example.com ' })).toEqual({});
  });

  it('requires an email and a password', () => {
    expect(validateCredentials({ mode: 'signIn', email: '', password: '' })).toEqual({
      email: 'Enter your email.',
      password: 'Enter your password.',
    });
  });

  it('rejects a malformed email', () => {
    expect(validateCredentials({ mode: 'signIn', ...good, email: 'me@example' }).email).toBe(
      'Enter a valid email address.',
    );
  });

  it('does not enforce the sign-up length rule on existing accounts', () => {
    expect(validateCredentials({ mode: 'signIn', ...good, password: 'short' })).toEqual({});
  });
});

describe('validateCredentials (sign up)', () => {
  it('passes valid input', () => {
    expect(validateCredentials({ mode: 'signUp', ...good })).toEqual({});
  });

  it(`requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateCredentials({ mode: 'signUp', ...good, password: short, confirm: short }).password).toBe(
      `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  });

  it('requires the confirmation to match', () => {
    expect(validateCredentials({ mode: 'signUp', ...good, confirm: 'different' }).confirm).toBe(
      'Passwords do not match.',
    );
  });

  it('treats a missing confirmation as a mismatch', () => {
    expect(validateCredentials({ mode: 'signUp', email: good.email, password: good.password }).confirm).toBe(
      'Passwords do not match.',
    );
  });
});
