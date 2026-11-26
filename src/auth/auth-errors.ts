/** The parts of a Supabase auth error this needs. */
export type AuthErrorLike = {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
};

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  email_address_invalid: 'This email address was not accepted. Check it and try again.',
  validation_failed: 'Check your email and password and try again.',
  weak_password: 'This password is too weak. Use a longer one.',
  email_not_confirmed: 'Confirm your email first. Check your inbox for the link.',
  signup_disabled: 'New accounts are turned off at the moment.',
  email_provider_disabled: 'Email sign-in is turned off for this project.',
  user_banned: 'This account has been blocked.',
  over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a while and try again.',
  request_timeout: 'The server took too long to answer. Try again.',
};

const NO_CONNECTION = 'No connection. Check your internet and try again.';
const FALLBACK = 'Something went wrong. Try again.';

/** Turns a Supabase auth error into one plain sentence for the user. */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return FALLBACK;

  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];

  // supabase-js reports a failed network request this way.
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return NO_CONNECTION;
  if (/network request failed|failed to fetch/i.test(error.message ?? '')) return NO_CONNECTION;

  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  if (error.status !== undefined && error.status >= 500) {
    return 'The server has a problem right now. Try again in a moment.';
  }
  return FALLBACK;
}
