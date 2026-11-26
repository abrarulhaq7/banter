import { act, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { useProfile, type Result } from '@/data';
import type { ProfileRow } from '@/lib/database.types';
import { createFakeProfileRepo, createMemoryCache, makeProfile, renderWithData } from '@/test-utils';

const latest: { value: ReturnType<typeof useProfile> | null } = { value: null };
const api = () => latest.value!;

function Probe() {
  const value = useProfile();
  useEffect(() => {
    latest.value = value;
  });
  return (
    <>
      <Text testID="status">{value.status}</Text>
      <Text testID="name">{value.profile?.display_name ?? 'none'}</Text>
      <Text testID="onboarded">{value.profile?.onboarded_at ? 'yes' : 'no'}</Text>
      <Text testID="error">{value.error ?? 'none'}</Text>
    </>
  );
}

const status = () => screen.getByTestId('status');

describe('ProfileProvider', () => {
  it('loads the profile and saves a copy on the phone', async () => {
    const fake = createFakeProfileRepo(makeProfile({ display_name: 'Sam' }));
    const memory = createMemoryCache<ProfileRow>();
    await renderWithData(<Probe />, { profileRepo: fake.repo, profileCache: memory.cache });

    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Sam'));
    expect(status()).toHaveTextContent('ready');
    await waitFor(() => expect(memory.current()?.display_name).toBe('Sam'));
  });

  it('works from the phone\'s copy when there is no internet', async () => {
    const fake = createFakeProfileRepo();
    fake.failNext();
    const memory = createMemoryCache<ProfileRow>(
      makeProfile({ display_name: 'Saved', onboarded_at: '2026-11-25T00:00:00Z' }),
    );
    await renderWithData(<Probe />, { profileRepo: fake.repo, profileCache: memory.cache });

    await waitFor(() => expect(screen.getByTestId('error')).not.toHaveTextContent('none'));
    expect(status()).toHaveTextContent('ready');
    expect(screen.getByTestId('name')).toHaveTextContent('Saved');
    expect(screen.getByTestId('onboarded')).toHaveTextContent('yes');
  });

  it('reports an error when there is no internet and no saved copy, then recovers on retry', async () => {
    const fake = createFakeProfileRepo(makeProfile({ display_name: 'Sam' }));
    fake.failNext();
    await renderWithData(<Probe />, { profileRepo: fake.repo });

    await waitFor(() => expect(status()).toHaveTextContent('error'));

    await act(async () => {
      await api().reload();
    });
    expect(status()).toHaveTextContent('ready');
    expect(screen.getByTestId('name')).toHaveTextContent('Sam');
  });

  it('saves changes to Supabase and to the phone', async () => {
    const fake = createFakeProfileRepo();
    const memory = createMemoryCache<ProfileRow>();
    await renderWithData(<Probe />, { profileRepo: fake.repo, profileCache: memory.cache });
    await waitFor(() => expect(status()).toHaveTextContent('ready'));

    let result!: Result;
    await act(async () => {
      result = await api().save({ display_name: 'Sam', onboarded_at: '2026-11-25T12:00:00Z' });
    });

    expect(result).toEqual({ ok: true });
    expect(screen.getByTestId('onboarded')).toHaveTextContent('yes');
    expect(fake.row().display_name).toBe('Sam');
    expect(memory.current()?.onboarded_at).toBe('2026-11-25T12:00:00Z');
  });

  it('reports a failed save and keeps the old values', async () => {
    const fake = createFakeProfileRepo(makeProfile({ display_name: 'Before' }));
    await renderWithData(<Probe />, { profileRepo: fake.repo });
    await waitFor(() => expect(status()).toHaveTextContent('ready'));
    fake.failNext();

    let result!: Result;
    await act(async () => {
      result = await api().save({ display_name: 'After' });
    });

    expect(result).toEqual({ ok: false, message: 'No connection. Check your internet and try again.' });
    expect(screen.getByTestId('name')).toHaveTextContent('Before');
  });
});
