import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { SettingsScreen } from '@/components/settings/settings-screen';
import { createFakeKeysRepo, createFakeProfileRepo, makeKey, makeProfile, renderWithData } from '@/test-utils';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignOut = jest.fn(async () => ({ ok: true as const }));
jest.mock('@/hooks/use-sign-out', () => ({
  useSignOut: () => mockSignOut,
}));

beforeEach(() => {
  mockPush.mockClear();
  mockSignOut.mockClear();
});

async function setup(keys = [makeKey()]) {
  const keysRepo = createFakeKeysRepo(keys);
  await renderWithData(<SettingsScreen />, {
    keysRepo: keysRepo.repo,
    profileRepo: createFakeProfileRepo(makeProfile({ display_name: 'Sam' })).repo,
  });
  await waitFor(() => expect(keysRepo.repo.list).toHaveBeenCalled());
  return userEvent.setup();
}

describe('SettingsScreen', () => {
  it('is a short menu: each row opens its own screen', async () => {
    const user = await setup();
    expect(await screen.findByText('Hi Sam.')).toBeOnTheScreen();
    expect(screen.getByTestId('account-email')).toHaveTextContent('sam@example.com');
    expect(await screen.findByText('1 key saved, 1 active.')).toBeOnTheScreen();

    await user.press(screen.getByTestId('edit-profile'));
    await user.press(screen.getByTestId('manage-keys'));
    await user.press(screen.getByTestId('open-theme'));

    await user.press(screen.getByTestId('open-data'));

    expect(mockPush.mock.calls.map(([route]) => route)).toEqual(['/profile', '/keys', '/theme', '/data']);
    expect(screen.getByTestId('open-theme')).toHaveTextContent(/Midnight Plum/);
  });

  it('goes straight to adding a key when there is none', async () => {
    const user = await setup([]);
    expect(await screen.findByText('No key yet. Add one to start generating lines.')).toBeOnTheScreen();

    await user.press(screen.getByTestId('manage-keys'));

    expect(mockPush).toHaveBeenCalledWith('/keys/add');
  });

  it('asks before signing out, and Cancel keeps the user signed in', async () => {
    const user = await setup();

    await user.press(screen.getByTestId('sign-out-button'));
    expect(screen.getByText('Sign out?')).toBeOnTheScreen();
    expect(mockSignOut).not.toHaveBeenCalled();

    await user.press(screen.getByTestId('dialog-cancel'));

    expect(screen.queryByText('Sign out?')).toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signs out when confirmed', async () => {
    const user = await setup();
    await user.press(screen.getByTestId('sign-out-button'));

    await user.press(screen.getByTestId('dialog-confirm'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });

  it('says why when signing out fails', async () => {
    mockSignOut.mockResolvedValueOnce({ ok: false, message: 'No connection.' } as never);
    const user = await setup();
    await user.press(screen.getByTestId('sign-out-button'));

    await user.press(screen.getByTestId('dialog-confirm'));

    expect(await screen.findByText('No connection.')).toBeOnTheScreen();
    expect(screen.queryByText('Sign out?')).toBeNull();
  });
});
