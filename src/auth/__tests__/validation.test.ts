import { validateEmail, validatePassword } from '@/auth';

describe('validateEmail', () => {
  it.each(['sam@example.com', '  sam@example.com  ', 'a.b+c@mail.co.uk'])('accepts %p', (email) => {
    expect(validateEmail(email)).toBeUndefined();
  });

  it('asks for an email when empty', () => {
    expect(validateEmail('   ')).toBe('Enter your email.');
  });

  it.each(['sam', 'sam@', 'sam@example', 'sam example@x.com', '@example.com'])('rejects %p', (email) => {
    expect(validateEmail(email)).toBe('This does not look like an email.');
  });
});

describe('validatePassword', () => {
  it('asks for a password when empty', () => {
    expect(validatePassword('', 'signIn')).toBe('Enter your password.');
    expect(validatePassword('', 'signUp')).toBe('Enter your password.');
  });

  it('requires 8 characters when creating an account', () => {
    expect(validatePassword('1234567', 'signUp')).toBe('Use at least 8 characters.');
    expect(validatePassword('12345678', 'signUp')).toBeUndefined();
  });

  it('does not apply the length rule when signing in', () => {
    expect(validatePassword('short', 'signIn')).toBeUndefined();
  });
});
