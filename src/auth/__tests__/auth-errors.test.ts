import { authErrorMessage } from '@/auth';

describe('authErrorMessage', () => {
  it.each([
    ['invalid_credentials', 'Wrong email or password.'],
    ['user_already_exists', 'An account with this email already exists. Sign in instead.'],
    ['weak_password', 'This password is too weak. Use a longer one.'],
    ['email_not_confirmed', 'Confirm your email first. Check your inbox for the link.'],
    ['over_request_rate_limit', 'Too many attempts. Wait a minute and try again.'],
  ])('explains %s', (code, message) => {
    expect(authErrorMessage({ code, status: 400, message: 'raw server text' })).toBe(message);
  });

  it('recognises a lost connection', () => {
    const message = 'No connection. Check your internet and try again.';
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', status: 0 })).toBe(message);
    expect(authErrorMessage({ message: 'Network request failed' })).toBe(message);
  });

  it('recognises rate limiting and server trouble by status', () => {
    expect(authErrorMessage({ status: 429 })).toBe('Too many attempts. Wait a minute and try again.');
    expect(authErrorMessage({ status: 503 })).toBe(
      'The server has a problem right now. Try again in a moment.',
    );
  });

  it('never shows raw server text for an unknown error', () => {
    expect(authErrorMessage({ code: 'something_new', message: 'pq: internal detail' })).toBe(
      'Something went wrong. Try again.',
    );
    expect(authErrorMessage(null)).toBe('Something went wrong. Try again.');
  });
});
