import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { KeyForm } from '@/components/key-form';
import type { KeyCheckResult } from '@/providers/check-key';
import { createFakeKeysRepo, makeKey, renderWithData } from '@/test-utils';

const accepted = (modelIds: string[]): KeyCheckResult => ({ ok: true, modelIds });
const ALL_MODELS = ['gemini-3.5-flash-lite', 'gpt-6-luna', 'claude-haiku-5-5', 'claude-sonnet-5-5'];

async function setup(checkResult: KeyCheckResult = accepted(ALL_MODELS), existing = [] as ReturnType<typeof makeKey>[]) {
  const fake = createFakeKeysRepo(existing);
  const check = jest.fn(async () => checkResult);
  const onSaved = jest.fn();
  await renderWithData(<KeyForm onSaved={onSaved} check={check} />, { keysRepo: fake.repo });
  // The model chips appear once the model list has loaded.
  await screen.findByRole('button', { name: 'Gemini 3.5 Flash-Lite' });
  return { fake, check, onSaved, user: userEvent.setup() };
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByRole('button', { name: 'Check and save' }));

describe('KeyForm', () => {
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

  it('switches the provider to match the key that was pasted', async () => {
    const { check, user } = await setup();

    await user.type(screen.getByLabelText('API key'), 'sk-ant-api03-test0001');

    expect(screen.getByRole('button', { name: 'Claude' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Claude Haiku 5.5' })).toBeSelected();

    await submit(user);
    await waitFor(() => expect(check).toHaveBeenCalledWith('claude', 'sk-ant-api03-test0001'));
  });

  it('keeps the provider the user picked, and warns when the key looks like another', async () => {
    const { user } = await setup();

    await user.press(screen.getByRole('button', { name: 'OpenAI' }));
    await user.type(screen.getByLabelText('API key'), 'AIzaTestKey0001');

    expect(screen.getByRole('button', { name: 'OpenAI' })).toBeSelected();
    expect(screen.getByText('This looks like a Gemini key. Check the provider above.')).toBeOnTheScreen();
  });

  it('saves the chosen model when it is not the default', async () => {
    const { fake, onSaved, user } = await setup();

    await user.press(screen.getByRole('button', { name: 'Claude' }));
    await user.press(screen.getByRole('button', { name: 'Claude Sonnet 5.5' }));
    await user.type(screen.getByLabelText('API key'), 'sk-ant-api03-test0001');
    await submit(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fake.repo.add).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'claude', model: 'claude-sonnet-5-5', label: 'Claude key' }),
    );
  });

  it('does not save when the key works but cannot use the chosen model', async () => {
    const { fake, user } = await setup(accepted(['some-other-model']));

    await user.type(screen.getByLabelText('API key'), 'AIzaTestKey0001');
    await submit(user);

    expect(await screen.findByTestId('key-error')).toHaveTextContent(
      'The key works, but it cannot use Gemini 3.5 Flash-Lite. Pick another model.',
    );
    expect(fake.repo.add).not.toHaveBeenCalled();
  });

  it('reports a save that fails after the key was accepted', async () => {
    const { fake, onSaved, user } = await setup();
    fake.failNext();

    await user.type(screen.getByLabelText('API key'), 'AIzaTestKey0001');
    await submit(user);

    expect(await screen.findByTestId('key-error')).toHaveTextContent(/No connection/);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
