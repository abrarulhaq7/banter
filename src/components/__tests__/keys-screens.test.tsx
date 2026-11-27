import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { AddKeyScreen } from '@/components/keys/add-key-screen';
import { KeyScreen } from '@/components/keys/key-screen';
import { KeysScreen } from '@/components/keys/keys-screen';
import type { KeyCheckResult } from '@/providers/check-key';
import { createFakeKeysRepo, makeKey, renderWithData } from '@/test-utils';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
});

const accepted = (modelIds: string[]): KeyCheckResult => ({ ok: true, modelIds });
const ALL_MODELS = [
  'gemini-3.5-flash-lite',
  'gpt-6-luna',
  'claude-haiku-5-5',
  'claude-sonnet-5-5',
  'qwen/qwen3.8-27b',
];

describe('AddKeyScreen', () => {
  async function setup(
    checkResult: KeyCheckResult = accepted(ALL_MODELS),
    existing = [] as ReturnType<typeof makeKey>[],
  ) {
    const fake = createFakeKeysRepo(existing);
    const check = jest.fn(async () => checkResult);
    const onSaved = jest.fn();
    await renderWithData(
      <AddKeyScreen testID="add-key-screen" title="Add a key" onSaved={onSaved} check={check} />,
      { keysRepo: fake.repo },
    );
    // The model row appears once the model list has loaded.
    await screen.findByTestId('key-model');
    return { fake, check, onSaved, user: userEvent.setup() };
  }

  const submit = (user: ReturnType<typeof userEvent.setup>) =>
    user.press(screen.getByRole('button', { name: 'Check and save' }));

  it('checks the key with the provider, then saves it', async () => {
    const { fake, check, onSaved, user } = await setup();

    await user.type(screen.getByLabelText('API key'), 'AIzaTestKey0001');
    await user.type(screen.getByLabelText('Name for this key (optional)'), 'Personal');
    await submit(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(check).toHaveBeenCalledWith('gemini', 'AIzaTestKey0001');
    expect(fake.repo.add).toHaveBeenCalledWith({
      provider: 'gemini',
      key: 'AIzaTestKey0001',
      label: 'Personal',
      model: null,
      sort_order: 0,
    });
  });

  it('does not save a key the provider rejects, and says why', async () => {
    const { fake, onSaved, user } = await setup({
      ok: false,
      reason: 'invalid',
      message: 'Gemini rejected this key. Check that you copied all of it and that it belongs to Gemini.',
    });

    await user.type(screen.getByLabelText('API key'), 'AIzaWrongKey0001');
    await submit(user);

    expect(await screen.findByTestId('key-error')).toHaveTextContent(/Gemini rejected this key/);
    expect(fake.repo.add).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('asks for a key before checking anything', async () => {
    const { check, user } = await setup();

    await submit(user);

    expect(screen.getByTestId('key-error')).toHaveTextContent('Paste your key first.');
    expect(check).not.toHaveBeenCalled();
  });

  it('catches a key that was only partly copied', async () => {
    const { check, user } = await setup();

    await user.type(screen.getByLabelText('API key'), 'AIza part two');
    await submit(user);

    expect(screen.getByTestId('key-error')).toHaveTextContent(/does not look like a complete key/);
    expect(check).not.toHaveBeenCalled();
  });

  it('refuses a key that is already saved', async () => {
    const { check, user } = await setup(accepted(ALL_MODELS), [makeKey({ key: 'AIzaTestKey0001' })]);

    await user.type(screen.getByLabelText('API key'), 'AIzaTestKey0001');
    await submit(user);

    expect(screen.getByTestId('key-error')).toHaveTextContent('You have already added this key.');
    expect(check).not.toHaveBeenCalled();
  });

  it('switches the provider to match the key that was pasted, with the model on automatic', async () => {
    const { check, user } = await setup();

    await user.type(screen.getByLabelText('API key'), 'sk-ant-api03-test0001');

    expect(screen.getByTestId('key-provider')).toHaveTextContent(/Claude/);
    expect(screen.getByTestId('key-model')).toHaveTextContent(/Automatic/);

    await submit(user);
    await waitFor(() => expect(check).toHaveBeenCalledWith('claude', 'sk-ant-api03-test0001'));
  });

  it.each([
    ['sk-or-v1-test0001', 'OpenRouter', 'openrouter'],
    ['gsk_test0001', 'Groq', 'groq'],
  ])('knows a %s key belongs to %s', async (key, name, provider) => {
    const { check, user } = await setup();

    await user.type(screen.getByLabelText('API key'), key);

    expect(screen.getByTestId('key-provider')).toHaveTextContent(new RegExp(name));
    await submit(user);
    await waitFor(() => expect(check).toHaveBeenCalledWith(provider, key));
  });

  it('picks the provider in a sheet that says what each costs, keeps it, and warns when the key looks like another', async () => {
    const { user } = await setup();

    await user.press(screen.getByTestId('key-provider'));
    expect(screen.getByTestId('provider-gemini')).toBeSelected();
    expect(screen.getByTestId('provider-openrouter')).toHaveTextContent(/Free models/);
    expect(screen.getByTestId('provider-claude')).toHaveTextContent(/Paid/);
    await user.press(screen.getByTestId('provider-openai'));

    // The sheet closes and the row shows the choice.
    expect(screen.queryByTestId('provider-openai')).toBeNull();
    await user.type(screen.getByLabelText('API key'), 'AIzaTestKey0001');

    expect(screen.getByTestId('key-provider')).toHaveTextContent(/OpenAI/);
    expect(screen.getByText('This looks like a Gemini key. Check the provider.')).toBeOnTheScreen();
  });

  it('picks one model in a sheet, instead of automatic', async () => {
    const { fake, onSaved, user } = await setup();

    await user.press(screen.getByTestId('key-provider'));
    await user.press(screen.getByTestId('provider-claude'));
    expect(screen.queryByTestId('model-claude-sonnet-5-5')).toBeNull();
    await user.press(screen.getByTestId('key-model'));
    expect(screen.getByTestId('model-automatic')).toBeSelected();
    expect(screen.getByTestId('model-automatic')).toHaveTextContent(/best model first/i);
    await user.press(screen.getByTestId('model-claude-sonnet-5-5'));

    // The sheet closes and the row shows the choice.
    expect(screen.queryByTestId('model-claude-sonnet-5-5')).toBeNull();
    expect(screen.getByTestId('key-model')).toHaveTextContent(/Claude Sonnet 5\.5/);

    await user.type(screen.getByLabelText('API key'), 'sk-ant-api03-test0001');
    await submit(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fake.repo.add).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'claude', model: 'claude-sonnet-5-5', label: 'Claude key' }),
    );
  });

  it('does not save when the key works but cannot use the chosen model', async () => {
    const { fake, user } = await setup(accepted(['some-other-model']));

    await user.press(screen.getByTestId('key-model'));
    await user.press(screen.getByTestId('model-gemini-3.5-flash-lite'));
    await user.type(screen.getByLabelText('API key'), 'AIzaTestKey0001');
    await submit(user);

    expect(await screen.findByTestId('key-error')).toHaveTextContent(
      'The key works, but it cannot use Gemini 3.5 Flash-Lite. Pick another model.',
    );
    expect(fake.repo.add).not.toHaveBeenCalled();
  });

  it('does not save an automatic key that can use none of the provider\'s models', async () => {
    const { fake, user } = await setup(accepted(['some-other-model']));

    await user.type(screen.getByLabelText('API key'), 'AIzaTestKey0001');
    await submit(user);

    expect(await screen.findByTestId('key-error')).toHaveTextContent(
      'The key works, but it cannot use any of the Gemini models Banter offers.',
    );
    expect(fake.repo.add).not.toHaveBeenCalled();
  });

  it('saves an OpenRouter key without a model check: every key may use every model', async () => {
    const { fake, onSaved, user } = await setup({ ok: true, modelIds: null });

    await user.type(screen.getByLabelText('API key'), 'sk-or-v1-test0001');
    await submit(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fake.repo.add).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openrouter', model: null }));
  });

  it('reports a save that fails after the key was accepted', async () => {
    const { fake, onSaved, user } = await setup();
    fake.failNext();

    await user.type(screen.getByLabelText('API key'), 'AIzaTestKey0001');
    await submit(user);

    expect(await screen.findByTestId('key-error')).toHaveTextContent(/No connection/);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('offers a second way on when one is given, and shows a problem from outside', async () => {
    const skip = jest.fn();
    await renderWithData(
      <AddKeyScreen
        testID="onboarding-key-screen"
        title="Your AI key"
        onSaved={jest.fn()}
        error="Could not save. Try again."
        secondary={{ testID: 'skip-key', label: 'Add a key later', onPress: skip }}
      />,
    );

    expect(screen.getByTestId('key-error')).toHaveTextContent('Could not save. Try again.');
    await userEvent.setup().press(screen.getByTestId('skip-key'));
    expect(skip).toHaveBeenCalledTimes(1);
  });
});

const TWO_KEYS = [
  makeKey({ id: 'key-a', label: 'Personal', sort_order: 0 }),
  makeKey({
    id: 'key-b',
    label: 'Backup',
    provider: 'claude',
    model: 'claude-haiku-5-5',
    key: 'test-claude-key-0002',
    sort_order: 1,
    status: 'invalid',
    last_error: 'Claude rejected this key.',
  }),
];

describe('KeysScreen', () => {
  async function setup(keys = TWO_KEYS) {
    const fake = createFakeKeysRepo(keys);
    await renderWithData(<KeysScreen />, { keysRepo: fake.repo });
    if (keys.length > 0) await screen.findByTestId('key-card-0');
    return { fake, user: userEvent.setup() };
  }

  it('shows one short row per key, in order, with its state and model', async () => {
    await setup();

    expect(screen.getByTestId('key-card-0')).toHaveTextContent(/Personal/);
    expect(screen.getByTestId('key-card-0')).toHaveTextContent(/Active · Gemini · Automatic/);
    expect(screen.getByTestId('key-card-1')).toHaveTextContent(/Backup/);
    expect(screen.getByTestId('key-card-1')).toHaveTextContent(/Rejected · Claude · Claude Haiku 5\.5/);
    // The provider's message is on the key's own screen, not in the list.
    expect(screen.queryByText('Claude rejected this key.')).toBeNull();
  });

  it('opens a key when its row is tapped', async () => {
    const { user } = await setup();

    await user.press(screen.getByTestId('key-card-1'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/keys/[id]', params: { id: 'key-b' } });
  });

  it('moves a key down, and cannot move the first up or the last down', async () => {
    const { fake, user } = await setup();

    expect(screen.getByTestId('key-up-0')).toBeDisabled();
    expect(screen.getByTestId('key-down-1')).toBeDisabled();

    await user.press(screen.getByRole('button', { name: 'Move Personal down' }));

    await waitFor(() => expect(fake.repo.setOrder).toHaveBeenCalledWith(['key-b', 'key-a']));
    expect(screen.getByTestId('key-card-0')).toHaveTextContent(/Backup/);
    // Moving did not open the key.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('puts the order back and says so when it cannot be saved', async () => {
    const { fake, user } = await setup();
    fake.failNext();

    await user.press(screen.getByTestId('key-down-0'));

    expect(await screen.findByTestId('keys-error')).toHaveTextContent(/No connection/);
    expect(screen.getByTestId('key-card-0')).toHaveTextContent(/Personal/);
  });

  it('has no order buttons for a single key', async () => {
    await setup([TWO_KEYS[0]]);

    expect(screen.queryByTestId('key-up-0')).toBeNull();
  });

  it('says so when there are no keys, and adds one from the pinned button', async () => {
    const { user } = await setup([]);

    expect(await screen.findByTestId('no-keys')).toBeOnTheScreen();
    await user.press(screen.getByTestId('add-key'));
    expect(mockPush).toHaveBeenCalledWith('/keys/add');
  });
});

describe('KeyScreen', () => {
  async function setup(id = 'key-a', checkResult: KeyCheckResult = accepted(ALL_MODELS), keys = TWO_KEYS) {
    const fake = createFakeKeysRepo(keys);
    const check = jest.fn(async () => checkResult);
    await renderWithData(<KeyScreen id={id} check={check} />, { keysRepo: fake.repo });
    await screen.findByTestId('edit-key-model');
    return { fake, check, user: userEvent.setup() };
  }

  it('is a short menu showing the name, the model and the state', async () => {
    await setup();

    expect(screen.getByTestId('edit-key-title')).toHaveTextContent('Personal');
    expect(screen.getByTestId('edit-key-name')).toHaveTextContent(/Personal/);
    expect(screen.getByTestId('edit-key-model')).toHaveTextContent(/Automatic/);
    expect(screen.getByTestId('edit-key-model')).not.toHaveTextContent(/At its limit/);
    expect(screen.getByTestId('edit-key-toggle')).toHaveTextContent(/Turn this key off/);
    expect(screen.getByTestId('edit-key-toggle')).toHaveTextContent(/Now: Active/);
    // Nothing to edit until a row is tapped.
    expect(screen.queryByTestId('edit-key-label')).toBeNull();
    expect(screen.queryByTestId('edit-key-error')).toBeNull();
  });

  it('shows what the provider last said about a rejected key', async () => {
    await setup('key-b');

    expect(screen.getByTestId('edit-key-error')).toHaveTextContent('Claude rejected this key.');
  });

  it('renames the key in a sheet', async () => {
    const { fake, user } = await setup();

    await user.press(screen.getByTestId('edit-key-name'));
    await user.clear(screen.getByTestId('edit-key-label'));
    await user.type(screen.getByTestId('edit-key-label'), 'Work');
    await user.press(screen.getByTestId('edit-key-save'));

    await waitFor(() => expect(fake.repo.update).toHaveBeenCalledWith('key-a', { label: 'Work' }));
    expect(screen.queryByTestId('edit-key-label')).toBeNull();
    expect(await screen.findByTestId('edit-key-title')).toHaveTextContent('Work');
  });

  it('does not save an empty name', async () => {
    const { fake, user } = await setup();

    await user.press(screen.getByTestId('edit-key-name'));
    await user.clear(screen.getByTestId('edit-key-label'));
    await user.press(screen.getByTestId('edit-key-save'));

    expect(screen.getByText('Give the key a name.')).toBeOnTheScreen();
    expect(fake.repo.update).not.toHaveBeenCalled();
  });

  it('changes the model in a sheet; Automatic is saved as no model', async () => {
    const { fake, user } = await setup('key-b');

    await user.press(screen.getByTestId('edit-key-model'));
    expect(screen.getByTestId('model-claude-haiku-5-5')).toBeSelected();
    await user.press(screen.getByTestId('model-claude-sonnet-5-5'));
    await waitFor(() => expect(fake.repo.update).toHaveBeenCalledWith('key-b', { model: 'claude-sonnet-5-5' }));
    await waitFor(() => expect(screen.getByTestId('edit-key-model')).toHaveTextContent(/Claude Sonnet 5\.5/));

    await user.press(screen.getByTestId('edit-key-model'));
    await user.press(screen.getByTestId('model-automatic'));
    await waitFor(() => expect(fake.repo.update).toHaveBeenCalledWith('key-b', { model: null }));
    await waitFor(() => expect(screen.getByTestId('edit-key-model')).toHaveTextContent(/Automatic/));
  });

  it('shows which models are at their limit, and until when', async () => {
    const now = new Date('2026-11-26T12:00:00Z').getTime();
    const fake = createFakeKeysRepo([
      makeKey({
        id: 'key-a',
        model_limits: { 'gemini-3.5-flash-lite': '2026-11-26T13:00:00Z', 'gone-model': '2026-11-26T13:00:00Z' },
      }),
    ]);
    await renderWithData(<KeyScreen id="key-a" check={jest.fn()} now={() => now} />, { keysRepo: fake.repo });

    const row = await screen.findByTestId('edit-key-model');
    expect(row).toHaveTextContent(/At its limit: Gemini 3\.5 Flash-Lite until/);
    // Only the key's own models are named, not a rest left from a model no longer offered.
    expect(row).not.toHaveTextContent(/gone-model/);
  });

  it('checks a rejected key again and marks it active when the provider accepts it', async () => {
    const { fake, check, user } = await setup('key-b');

    await user.press(screen.getByTestId('edit-key-check'));

    await waitFor(() =>
      expect(fake.repo.update).toHaveBeenCalledWith('key-b', { status: 'active', last_error: null }),
    );
    expect(check).toHaveBeenCalledWith('claude', 'test-claude-key-0002');
    await waitFor(() => expect(screen.queryByTestId('edit-key-error')).toBeNull());
  });

  it('marks the key rejected when the provider refuses it', async () => {
    const { fake, user } = await setup('key-a', {
      ok: false,
      reason: 'invalid',
      message: 'Gemini rejected this key.',
    });

    await user.press(screen.getByTestId('edit-key-check'));

    expect(await screen.findByTestId('edit-key-error')).toHaveTextContent('Gemini rejected this key.');
    expect(fake.repo.update).toHaveBeenCalledWith('key-a', {
      status: 'invalid',
      last_error: 'Gemini rejected this key.',
    });
  });

  it('turns the key off and on again', async () => {
    const { fake, user } = await setup();

    await user.press(screen.getByTestId('edit-key-toggle'));
    await waitFor(() =>
      expect(fake.repo.update).toHaveBeenCalledWith('key-a', { status: 'disabled', last_error: null }),
    );
    await waitFor(() => expect(screen.getByTestId('edit-key-toggle')).toHaveTextContent(/Turn this key on/));

    await user.press(screen.getByTestId('edit-key-toggle'));
    await waitFor(() =>
      expect(fake.repo.update).toHaveBeenCalledWith('key-a', { status: 'active', last_error: null }),
    );
  });

  it('asks before deleting, and does nothing on Cancel', async () => {
    const { fake, user } = await setup();

    await user.press(screen.getByTestId('edit-key-delete'));
    expect(screen.getByText('Delete this key?')).toBeOnTheScreen();
    await user.press(screen.getByTestId('dialog-cancel'));

    expect(screen.queryByText('Delete this key?')).toBeNull();
    expect(fake.repo.remove).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('deletes after the confirmation and goes back to the list', async () => {
    const { fake, user } = await setup();

    await user.press(screen.getByTestId('edit-key-delete'));
    await user.press(screen.getByTestId('dialog-confirm'));

    await waitFor(() => expect(fake.repo.remove).toHaveBeenCalledWith('key-a'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('says so when the key is gone', async () => {
    await renderWithData(<KeyScreen id="no-such-key" />, { keysRepo: createFakeKeysRepo(TWO_KEYS).repo });

    expect(await screen.findByText('Key not found')).toBeOnTheScreen();
  });
});
