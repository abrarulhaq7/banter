import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { AppState, Pressable, Text } from 'react-native';

import { useAuth, type AuthResult } from '@/auth';
import { createFakeAuthClient, fakeSession, renderWithApp } from '@/test-utils';

/** Shows the auth state and runs each action, printing its result. */
function Probe() {
  const { status, session, setupProblem, signIn, signUp, signOut } = useAuth();
  const [result, setResult] = useState<AuthResult | null>(null);
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="email">{session?.user.email ?? 'none'}</Text>
      <Text testID="setup">{setupProblem ?? 'none'}</Text>
      <Text testID="result">{result ? JSON.stringify(result) : 'none'}</Text>
      <Pressable accessibilityRole="button" onPress={async () => setResult(await signIn(' sam@example.com ', 'pw'))}>
        <Text>in</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={async () => setResult(await signUp('sam@example.com', 'password1'))}>
        <Text>up</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={async () => setResult(await signOut())}>
        <Text>out</Text>
      </Pressable>
    </>
  );
}

const press = (name: string) => userEvent.setup().press(screen.getByRole('button', { name }));
const result = () => screen.getByTestId('result');

describe('AuthProvider', () => {
  it('is signed out when no session is saved on the phone', async () => {
    const fake = createFakeAuthClient(null);
    await renderWithApp(<Probe />, { client: fake.client });

    expect(await screen.findByText('signedOut')).toBeOnTheScreen();
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('stays signed in when a session is saved on the phone', async () => {
    const fake = createFakeAuthClient(fakeSession('sam@example.com'));
    await renderWithApp(<Probe />, { client: fake.client });

    expect(await screen.findByText('signedIn')).toBeOnTheScreen();
    expect(screen.getByTestId('email')).toHaveTextContent('sam@example.com');
  });

  it('follows later sign-ins and sign-outs', async () => {
    const fake = createFakeAuthClient(null);
    await renderWithApp(<Probe />, { client: fake.client });
    await screen.findByText('signedOut');

    await act(async () => fake.emit(fakeSession('sam@example.com')));
    expect(screen.getByTestId('status')).toHaveTextContent('signedIn');

    await act(async () => fake.emit(null));
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('signs in with the trimmed email', async () => {
    const fake = createFakeAuthClient(null);
    await renderWithApp(<Probe />, { client: fake.client });
    await screen.findByText('signedOut');

    await press('in');

    expect(fake.mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'pw',
    });
    expect(result()).toHaveTextContent('{"ok":true}');
  });

  it('explains a wrong password in plain words', async () => {
    const fake = createFakeAuthClient(null);
    fake.mocks.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    } as never);
    await renderWithApp(<Probe />, { client: fake.client });
    await screen.findByText('signedOut');

    await press('in');

    expect(result()).toHaveTextContent('{"ok":false,"message":"Wrong email or password."}');
  });

  it('explains a lost connection when the request itself fails', async () => {
    const fake = createFakeAuthClient(null);
    fake.mocks.signInWithPassword.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderWithApp(<Probe />, { client: fake.client });
    await screen.findByText('signedOut');

    await press('in');

    expect(result()).toHaveTextContent(/No connection\. Check your internet and try again\./);
  });

  it('creates an account', async () => {
    const fake = createFakeAuthClient(null);
    await renderWithApp(<Probe />, { client: fake.client });
    await screen.findByText('signedOut');

    await press('up');

    expect(fake.mocks.signUp).toHaveBeenCalledWith({ email: 'sam@example.com', password: 'password1' });
    expect(result()).toHaveTextContent('{"ok":true,"needsEmailConfirmation":false}');
  });

  it('says so when the account still needs email confirmation', async () => {
    const fake = createFakeAuthClient(null);
    fake.mocks.signUp.mockResolvedValueOnce({ data: { session: null }, error: null } as never);
    await renderWithApp(<Probe />, { client: fake.client });
    await screen.findByText('signedOut');

    await press('up');

    expect(result()).toHaveTextContent('{"ok":true,"needsEmailConfirmation":true}');
  });

  it('signs out on this phone only, so it works without internet', async () => {
    const fake = createFakeAuthClient(fakeSession());
    await renderWithApp(<Probe />, { client: fake.client });
    await screen.findByText('signedIn');

    await press('out');

    expect(fake.mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result()).toHaveTextContent('{"ok":true}');
  });

  it('pauses session refresh in the background and resumes in the foreground', async () => {
    const remove = jest.fn();
    const addEventListener = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
    const fake = createFakeAuthClient(null);
    const view = await renderWithApp(<Probe />, { client: fake.client });
    await screen.findByText('signedOut');
    // Other parts of React Native listen to the app state too, so notify every listener.
    const onChange = (state: 'active' | 'background') =>
      addEventListener.mock.calls
        .filter(([event]) => event === 'change')
        .forEach(([, listener]) => listener(state));

    onChange('background');
    expect(fake.mocks.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(fake.mocks.startAutoRefresh).not.toHaveBeenCalled();

    onChange('active');
    expect(fake.mocks.startAutoRefresh).toHaveBeenCalledTimes(1);

    await view.unmount();
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    addEventListener.mockRestore();
  });

  it('is signed out and explains why when Supabase is not set up', async () => {
    await renderWithApp(<Probe />, { client: null, setupProblem: 'Supabase is not connected.' });

    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    expect(screen.getByTestId('setup')).toHaveTextContent('Supabase is not connected.');

    await press('in');
    expect(result()).toHaveTextContent('{"ok":false,"message":"Supabase is not connected."}');
  });

  it('fails loudly when used outside the provider', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow('useAuth must be used inside <AuthProvider>');
    error.mockRestore();
  });
});
