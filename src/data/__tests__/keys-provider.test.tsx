import { act, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { useKeys, type CachedKeys, type Result } from '@/data';
import {
  createFakeKeysRepo,
  createMemoryCache,
  makeKey,
  makeModels,
  renderWithData,
} from '@/test-utils';

type KeysApi = ReturnType<typeof useKeys>;
const latest: { value: KeysApi | null } = { value: null };
const api = () => latest.value!;

/** Shows the list and hands the provider's functions to the test. */
function Probe() {
  const value = useKeys();
  useEffect(() => {
    latest.value = value;
  });
  return (
    <>
      <Text testID="status">{value.status}</Text>
      <Text testID="labels">{value.keys.map((key) => key.label).join(',') || 'none'}</Text>
      <Text testID="load-error">{value.loadError ?? 'none'}</Text>
      <Text testID="models">{value.models.length}</Text>
    </>
  );
}

const labels = () => screen.getByTestId('labels');
const call = async (action: () => Promise<Result>) => {
  let result!: Result;
  await act(async () => {
    result = await action();
  });
  return result;
};

const A = makeKey({ id: 'a', label: 'A', sort_order: 0 });
const B = makeKey({ id: 'b', label: 'B', sort_order: 1, key: 'test-gemini-key-0002' });
const C = makeKey({ id: 'c', label: 'C', sort_order: 2, key: 'test-gemini-key-0003' });

describe('KeysProvider', () => {
  it('loads the keys and models from Supabase and saves a copy on the phone', async () => {
    const fake = createFakeKeysRepo([B, A]);
    const memory = createMemoryCache<CachedKeys>();
    await renderWithData(<Probe />, { keysRepo: fake.repo, keysCache: memory.cache });

    await waitFor(() => expect(labels()).toHaveTextContent('A,B'));
    expect(screen.getByTestId('models')).toHaveTextContent('6');
    await waitFor(() => expect(memory.current()?.keys.map((key) => key.id)).toEqual(['a', 'b']));
  });

  it('shows the phone\'s copy when there is no internet, and says so', async () => {
    const fake = createFakeKeysRepo([A]);
    fake.failNext();
    const memory = createMemoryCache<CachedKeys>({ keys: [A, B], models: makeModels() });
    await renderWithData(<Probe />, { keysRepo: fake.repo, keysCache: memory.cache });

    await waitFor(() =>
      expect(screen.getByTestId('load-error')).toHaveTextContent(
        'No connection. Check your internet and try again.',
      ),
    );
    expect(labels()).toHaveTextContent('A,B');
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
  });

  it('picks up a key that was replaced in the database', async () => {
    const fake = createFakeKeysRepo([makeKey({ id: 'a', label: 'Replaced in dashboard' })]);
    const memory = createMemoryCache<CachedKeys>({ keys: [A], models: makeModels() });
    await renderWithData(<Probe />, { keysRepo: fake.repo, keysCache: memory.cache });

    await waitFor(() => expect(labels()).toHaveTextContent('Replaced in dashboard'));
  });

  it('adds a key at the end of the order', async () => {
    const fake = createFakeKeysRepo([A, B]);
    const memory = createMemoryCache<CachedKeys>();
    await renderWithData(<Probe />, { keysRepo: fake.repo, keysCache: memory.cache });
    await waitFor(() => expect(labels()).toHaveTextContent('A,B'));

    const result = await call(() =>
      api().addKey({ provider: 'openai', label: 'New', key: 'sk-test-0001', model: null }),
    );

    expect(result).toEqual({ ok: true });
    expect(labels()).toHaveTextContent('A,B,New');
    expect(fake.repo.add).toHaveBeenCalledWith({
      provider: 'openai',
      label: 'New',
      key: 'sk-test-0001',
      model: null,
      sort_order: 2,
    });
    expect(memory.current()?.keys).toHaveLength(3);
  });

  it('reports a failed save and leaves the list as it was', async () => {
    const fake = createFakeKeysRepo([A]);
    await renderWithData(<Probe />, { keysRepo: fake.repo });
    await waitFor(() => expect(labels()).toHaveTextContent('A'));
    fake.failNext();

    const result = await call(() =>
      api().addKey({ provider: 'openai', label: 'New', key: 'sk-test-0001', model: null }),
    );

    expect(result).toEqual({ ok: false, message: 'No connection. Check your internet and try again.' });
    expect(labels()).toHaveTextContent('A');
  });

  it('updates and deletes a key', async () => {
    const fake = createFakeKeysRepo([A, B]);
    const memory = createMemoryCache<CachedKeys>();
    await renderWithData(<Probe />, { keysRepo: fake.repo, keysCache: memory.cache });
    await waitFor(() => expect(labels()).toHaveTextContent('A,B'));

    await call(() => api().updateKey('a', { label: 'Renamed', status: 'disabled' }));
    expect(labels()).toHaveTextContent('Renamed,B');
    expect(api().keys[0].status).toBe('disabled');

    await call(() => api().removeKey('a'));
    expect(labels()).toHaveTextContent('B');
    expect(fake.rows().map((row) => row.id)).toEqual(['b']);
    expect(memory.current()?.keys.map((key) => key.id)).toEqual(['b']);
  });

  it('keeps every change when several keys are changed one after another, before the screen redraws', async () => {
    // One request can save a limit on two keys in a row; the second must not undo the first.
    const fake = createFakeKeysRepo([A, B]);
    await renderWithData(<Probe />, { keysRepo: fake.repo });
    await waitFor(() => expect(labels()).toHaveTextContent('A,B'));

    const { updateKey } = api();
    await act(async () => {
      await updateKey('a', { label: 'First' });
      await updateKey('b', { label: 'Second' });
    });

    expect(labels()).toHaveTextContent('First,Second');
  });

  it('moves a key up and saves the new order', async () => {
    const fake = createFakeKeysRepo([A, B, C]);
    await renderWithData(<Probe />, { keysRepo: fake.repo });
    await waitFor(() => expect(labels()).toHaveTextContent('A,B,C'));

    await call(() => api().moveKey('c', 'up'));

    expect(labels()).toHaveTextContent('A,C,B');
    expect(fake.repo.setOrder).toHaveBeenCalledWith(['a', 'c', 'b']);
    expect(api().keys.map((key) => key.sort_order)).toEqual([0, 1, 2]);
  });

  it('puts the old order back if the new one cannot be saved', async () => {
    const fake = createFakeKeysRepo([A, B]);
    await renderWithData(<Probe />, { keysRepo: fake.repo });
    await waitFor(() => expect(labels()).toHaveTextContent('A,B'));
    fake.failNext();

    const result = await call(() => api().moveKey('b', 'up'));

    expect(result.ok).toBe(false);
    expect(labels()).toHaveTextContent('A,B');
  });

  it('does nothing when the top key is moved up', async () => {
    const fake = createFakeKeysRepo([A, B]);
    await renderWithData(<Probe />, { keysRepo: fake.repo });
    await waitFor(() => expect(labels()).toHaveTextContent('A,B'));

    expect(await call(() => api().moveKey('a', 'up'))).toEqual({ ok: true });
    expect(fake.repo.setOrder).not.toHaveBeenCalled();
  });
});
