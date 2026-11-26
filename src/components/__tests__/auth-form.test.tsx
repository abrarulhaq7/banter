import { screen, userEvent } from '@testing-library/react-native';

import { AuthForm } from '@/components/auth-form';
import { createFakeAuthClient, renderWithApp } from '@/test-utils';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  return user;
}

beforeEach(() => mockReplace.mockClear());

describe('AuthForm: sign in', () => {
  it('signs in with what was typed', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm mode="signIn" />, { client: fake.client });

    const user = await fill('sam@example.com', 'hunter22');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(fake.mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'hunter22',
    });
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('shows what is missing and does not call the server', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm mode="signIn" />, { client: fake.client });

    await userEvent.setup().press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your email.')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
    expect(fake.mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('does not show field errors before the first attempt', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm mode="signIn" />, { client: fake.client });

    await fill('sam', '');

    expect(screen.queryByText('This does not look like an email.')).toBeNull();
  });

  it('shows the server error in plain words', async () => {
    const fake = createFakeAuthClient();
    fake.mocks.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    } as never);
    await renderWithApp(<AuthForm mode="signIn" />, { client: fake.client });

    const user = await fill('sam@example.com', 'wrong-password');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByTestId('form-error')).toHaveTextContent('Wrong email or password.');
  });

  it('links to the sign-up screen', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm mode="signIn" />, { client: fake.client });

    await userEvent.setup().press(screen.getByRole('button', { name: 'Create an account' }));

    expect(mockReplace).toHaveBeenCalledWith('/sign-up');
  });

  it('explains what to do when Supabase is not set up', async () => {
    await renderWithApp(<AuthForm mode="signIn" />, {
      client: null,
      setupProblem: 'Supabase is not connected. Add the settings to .env.local.',
    });

    expect(screen.getByText('Setup needed')).toBeOnTheScreen();

    const user = await fill('sam@example.com', 'hunter22');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByTestId('form-error')).toHaveTextContent(/Supabase is not connected\./);
  });
});

describe('AuthForm: sign up', () => {
  it('creates the account', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm mode="signUp" />, { client: fake.client });

    const user = await fill('sam@example.com', 'long-enough');
    await user.press(screen.getByRole('button', { name: 'Create account' }));

    expect(fake.mocks.signUp).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'long-enough',
    });
    expect(screen.queryByTestId('form-notice')).toBeNull();
  });

  it('rejects a short password before calling the server', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm mode="signUp" />, { client: fake.client });

    const user = await fill('sam@example.com', 'short');
    await user.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();
    expect(fake.mocks.signUp).not.toHaveBeenCalled();
  });

  it('tells the user to confirm their email when the project requires it', async () => {
    const fake = createFakeAuthClient();
    fake.mocks.signUp.mockResolvedValueOnce({ data: { session: null }, error: null } as never);
    await renderWithApp(<AuthForm mode="signUp" />, { client: fake.client });

    const user = await fill('sam@example.com', 'long-enough');
    await user.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByTestId('form-notice')).toHaveTextContent(/Confirm your email/);
  });

  it('says so when the email is already registered', async () => {
    const fake = createFakeAuthClient();
    fake.mocks.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { code: 'user_already_exists', status: 422, message: 'User already registered' },
    } as never);
    await renderWithApp(<AuthForm mode="signUp" />, { client: fake.client });

    const user = await fill('sam@example.com', 'long-enough');
    await user.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByTestId('form-error')).toHaveTextContent(/already exists/);
  });
});
