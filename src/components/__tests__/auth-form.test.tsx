import { screen, userEvent } from '@testing-library/react-native';

import { AuthForm } from '@/components/auth-form';
import { createFakeAuthClient, renderWithApp } from '@/test-utils';

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  return user;
}

describe('AuthForm: sign in', () => {
  it('signs in with what was typed', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm />, { client: fake.client });

    const user = await fill('sam@example.com', 'hunter22');
    await user.press(screen.getByTestId('submit-button'));

    expect(fake.mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'hunter22',
    });
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('hides the password, shows it with the eye button, and hides it again', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm />, { client: fake.client });
    const user = await fill('', 'hunter22');
    const password = () => screen.getByTestId('password-input');

    expect(password()).toHaveProp('secureTextEntry', true);

    await user.press(screen.getByRole('button', { name: 'Show password' }));
    expect(password()).toHaveProp('secureTextEntry', false);
    expect(password()).toHaveDisplayValue('hunter22');

    await user.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(password()).toHaveProp('secureTextEntry', true);
  });

  it('shows what is missing and does not call the server', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm />, { client: fake.client });

    await userEvent.setup().press(screen.getByTestId('submit-button'));

    expect(screen.getByText('Enter your email.')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
    expect(fake.mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('does not show field errors before the first attempt', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm />, { client: fake.client });

    await fill('sam', '');

    expect(screen.queryByText('This does not look like an email.')).toBeNull();
  });

  it('shows the server error in plain words', async () => {
    const fake = createFakeAuthClient();
    fake.mocks.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    } as never);
    await renderWithApp(<AuthForm />, { client: fake.client });

    const user = await fill('sam@example.com', 'wrong-password');
    await user.press(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('form-error')).toHaveTextContent('Wrong email or password.');
  });

  it('switches to sign up on the same screen, keeping the email', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm />, { client: fake.client });
    const user = await fill('sam@example.com', '');
    await user.press(screen.getByTestId('submit-button'));
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();

    await user.press(screen.getByTestId('auth-mode-signUp'));

    expect(screen.getByTestId('sign-up-screen')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeSelected();
    expect(screen.getByText('Create your account.')).toBeOnTheScreen();
    expect(screen.getByTestId('submit-button')).toHaveAccessibleName('Create account');
    // The rule is in the empty field, not under it.
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeOnTheScreen();
    expect(screen.queryByText('At least 8 characters.')).toBeNull();
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('sam@example.com');
    // What was said about the other form is gone.
    expect(screen.queryByText('Enter your password.')).toBeNull();

    await user.press(screen.getByTestId('auth-mode-signIn'));
    expect(screen.getByTestId('sign-in-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('submit-button')).toHaveAccessibleName('Sign in');
  });

  it('shows the logo above the form', async () => {
    await renderWithApp(<AuthForm />, { client: createFakeAuthClient().client });

    expect(screen.getByRole('header', { name: 'Banter' })).toBeOnTheScreen();
    expect(screen.getByTestId('auth-logo')).toBeOnTheScreen();
  });

  it('creates an account after switching to sign up', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm />, { client: fake.client });
    const user = userEvent.setup();

    await user.press(screen.getByTestId('auth-mode-signUp'));
    await fill('sam@example.com', 'long-enough');
    await user.press(screen.getByTestId('submit-button'));

    expect(fake.mocks.signUp).toHaveBeenCalledWith({ email: 'sam@example.com', password: 'long-enough' });
    expect(fake.mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('explains what to do when Supabase is not set up', async () => {
    await renderWithApp(<AuthForm />, {
      client: null,
      setupProblem: 'Supabase is not connected. Add the settings to .env.local.',
    });

    expect(screen.getByText('Setup needed')).toBeOnTheScreen();

    const user = await fill('sam@example.com', 'hunter22');
    await user.press(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('form-error')).toHaveTextContent(/Supabase is not connected\./);
  });
});

describe('AuthForm: sign up', () => {
  it('creates the account', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm initialMode="signUp" />, { client: fake.client });

    const user = await fill('sam@example.com', 'long-enough');
    await user.press(screen.getByTestId('submit-button'));

    expect(fake.mocks.signUp).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'long-enough',
    });
    expect(screen.queryByTestId('form-notice')).toBeNull();
  });

  it('rejects a short password before calling the server', async () => {
    const fake = createFakeAuthClient();
    await renderWithApp(<AuthForm initialMode="signUp" />, { client: fake.client });

    const user = await fill('sam@example.com', 'short');
    await user.press(screen.getByTestId('submit-button'));

    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();
    expect(fake.mocks.signUp).not.toHaveBeenCalled();
  });

  it('tells the user to confirm their email when the project requires it', async () => {
    const fake = createFakeAuthClient();
    fake.mocks.signUp.mockResolvedValueOnce({ data: { session: null }, error: null } as never);
    await renderWithApp(<AuthForm initialMode="signUp" />, { client: fake.client });

    const user = await fill('sam@example.com', 'long-enough');
    await user.press(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('form-notice')).toHaveTextContent(/Confirm your email/);
  });

  it('says so when the email is already registered', async () => {
    const fake = createFakeAuthClient();
    fake.mocks.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: { code: 'user_already_exists', status: 422, message: 'User already registered' },
    } as never);
    await renderWithApp(<AuthForm initialMode="signUp" />, { client: fake.client });

    const user = await fill('sam@example.com', 'long-enough');
    await user.press(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('form-error')).toHaveTextContent(/already exists/);
  });
});
