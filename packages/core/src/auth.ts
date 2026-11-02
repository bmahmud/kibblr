export type AuthMode = 'signIn' | 'signUp';

export type CredentialInput = {
  mode: AuthMode;
  email: string;
  password: string;
  confirm?: string;
};

export type CredentialErrors = Partial<Record<'email' | 'password' | 'confirm', string>>;

/** Firebase's own floor is 6; we ask for a little more on new accounts. */
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side checks before calling Firebase. Returns {} when the input is fine. */
export function validateCredentials({ mode, email, password, confirm }: CredentialInput): CredentialErrors {
  const errors: CredentialErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Enter your email.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Enter your password.';
  } else if (mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (mode === 'signUp' && password && confirm !== password) {
    errors.confirm = 'Passwords do not match.';
  }

  return errors;
}
