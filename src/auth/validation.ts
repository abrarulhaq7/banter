export const MIN_PASSWORD_LENGTH = 8;

/** Returns a message to show under the field, or undefined when the value is fine. */
export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return 'Enter your email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'This does not look like an email.';
  return undefined;
}

/**
 * Sign-up checks the length. Sign-in only checks that something was typed, so an
 * existing password is never rejected by a rule that came later.
 */
export function validatePassword(password: string, purpose: 'signIn' | 'signUp'): string | undefined {
  if (!password) return 'Enter your password.';
  if (purpose === 'signUp' && password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return undefined;
}
