import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';

import { GenerateScreen } from '@/components/generate/generate-screen';
import { EngineError, type GenerateOptions, type GenerationResult, type ModelOutput } from '@/engine';
import type { GenerateDeps } from '@/generate/use-generate';
import type { ScreenshotResult } from '@/screenshot/types';
import { createFakeKeysRepo, makeKey, makeProfile, createFakeProfileRepo, renderWithData } from '@/test-utils';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const SCREENSHOT: ScreenshotResult = {
  ok: true,
  screenshot: {
    previewUri: 'file:///shot.jpg',
    image: { base64: 'QUJD', mediaType: 'image/jpeg' },
    width: 589,
    height: 1280,
  },
};

const lines = (prefix: string): ModelOutput => ({
  kind: 'lines',
  username: 'some.one',
  screenType: 'story',
  noticed: 'A bowl of pho.',
  lines: [
    { text: `${prefix} one`, hook: 'the broth' },
    { text: `${prefix} two`, hook: 'table 24' },
    { text: `${prefix} three`, hook: 'the herbs' },
  ],
});

const result = (output: ModelOutput): GenerationResult => ({
  output,
  usedKey: { id: 'key-1', label: 'Main', provider: 'gemini', model: 'gemini-3.5-flash-lite' },
  promptVersion: 4,
  durationMs: 2000,
});

type Setup = {
  outputs?: (ModelOutput | EngineError)[];
  keys?: ReturnType<typeof makeKey>[];
  latest?: ScreenshotResult;
};

async function setup({ outputs = [lines('Casual')], keys = [makeKey()], latest = SCREENSHOT }: Setup = {}) {
  const calls: GenerateOptions[] = [];
  const keysRepo = createFakeKeysRepo(keys);
  const deps: GenerateDeps = {
    getLatestScreenshot: jest.fn(async () => latest),
    pickFromGallery: jest.fn(async () => SCREENSHOT),
    copy: jest.fn(async () => true),
    runEngine: jest.fn(async (options: GenerateOptions) => {
      calls.push(options);
      const next = outputs[Math.min(calls.length - 1, outputs.length - 1)];
      if (next instanceof EngineError) throw next;
      return result(next);
    }),
  };
  await renderWithData(<GenerateScreen deps={deps} />, {
    keysRepo: keysRepo.repo,
    profileRepo: createFakeProfileRepo(makeProfile({ display_name: 'Sam', texting_style: 'short, dry' })).repo,
  });
  // Wait for the keys to load, so the screen knows whether there is one.
  await waitFor(() => expect(keysRepo.repo.list).toHaveBeenCalled());
  await act(async () => {});
  return { deps, calls, keysRepo, user: userEvent.setup() };
}

const press = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.press(screen.getByRole('button', { name }));

beforeEach(() => mockPush.mockClear());

describe('GenerateScreen: getting lines', () => {
  it('cannot generate before a screenshot is chosen', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Get lines' })).toBeDisabled();
    expect(screen.queryByTestId('screenshot-preview')).toBeNull();
  });

  it('shows the newest screenshot, then three lines with what was noticed and the username', async () => {
    const { calls, user } = await setup();

    await press(user, 'Use latest screenshot');
    expect(await screen.findByTestId('screenshot-preview')).toBeOnTheScreen();

    await press(user, 'Get lines');

    expect(await screen.findByText('Casual one')).toBeOnTheScreen();
    expect(screen.getByText('Casual two')).toBeOnTheScreen();
    expect(screen.getByText('Casual three')).toBeOnTheScreen();
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Casual · Story reply');
    expect(screen.getByTestId('result-username-0')).toHaveTextContent('@some.one');
    expect(screen.getByTestId('result-noticed-0')).toHaveTextContent('Noticed: A bowl of pho.');
    expect(screen.getByText('the broth')).toBeOnTheScreen();

    expect(calls[0].image).toEqual({ base64: 'QUJD', mediaType: 'image/jpeg' });
    expect(calls[0].keys).toEqual([expect.objectContaining({ id: 'key-1', model: 'gemini-3.5-flash-lite' })]);
    expect(calls[0].prompt).toMatchObject({
      mode: 'story_reply',
      tone: { label: 'Casual' },
      context: null,
      profile: { name: 'Sam', textingStyle: 'short, dry' },
      adjustment: null,
    });
  });

  it('sends the chosen mode, tone and context', async () => {
    const { calls, user } = await setup();
    await press(user, 'Pick from gallery');
    await screen.findByTestId('screenshot-preview');

    await press(user, 'Opener');
    await press(user, 'Flirty');
    await press(user, 'Stranger');
    await press(user, 'Get lines');
    await screen.findByTestId('result-set-0');

    expect(calls[0].prompt).toMatchObject({ mode: 'opener', tone: { label: 'Flirty' }, context: 'stranger' });
  });

  it('copies a line when it is tapped and marks it as copied', async () => {
    const { deps, user } = await setup();
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');
    await screen.findByText('Casual two');

    await user.press(screen.getByRole('button', { name: 'Casual two' }));

    expect(deps.copy).toHaveBeenCalledWith('Casual two');
    expect(screen.getByTestId('line-status-0-1')).toHaveTextContent('Copied');
    expect(screen.getByTestId('line-status-0-0')).toHaveTextContent('Tap to copy');
  });
});

describe('GenerateScreen: nothing is replaced, and lines can be kept', () => {
  it('adds the new tone above the earlier set and keeps the earlier lines on screen', async () => {
    const { user } = await setup({ outputs: [lines('Casual'), lines('Flirty')] });
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');
    await screen.findByText('Casual one');

    await press(user, 'Flirty');
    await press(user, 'Get lines in this tone');
    await screen.findByText('Flirty one');

    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Flirty · Story reply');
    expect(screen.getByTestId('result-heading-1')).toHaveTextContent('Casual · Story reply');
    expect(screen.getByText('Casual one')).toBeOnTheScreen();
  });

  it('pins a kept line in the Kept strip, where it stays through later generations', async () => {
    const { deps, user } = await setup({ outputs: [lines('Casual'), lines('Flirty'), lines('Funny')] });
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');
    await screen.findByText('Casual two');

    await user.press(screen.getByTestId('keep-0-1'));

    const strip = screen.getByTestId('kept-strip');
    expect(within(strip).getByText('Casual two')).toBeOnTheScreen();
    expect(within(strip).getByText('Casual · Story reply')).toBeOnTheScreen();

    await press(user, 'Flirty');
    await press(user, 'Get lines in this tone');
    await screen.findByText('Flirty one');
    await press(user, 'Funny');
    await press(user, 'Get lines in this tone');
    await screen.findByText('Funny one');

    expect(within(screen.getByTestId('kept-strip')).getByText('Casual two')).toBeOnTheScreen();

    await user.press(screen.getByTestId('line-kept-0'));
    expect(deps.copy).toHaveBeenLastCalledWith('Casual two');
  });

  it('removes a line from the Kept strip when Kept is tapped', async () => {
    const { user } = await setup();
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');
    await screen.findByText('Casual one');
    await user.press(screen.getByTestId('keep-0-0'));
    expect(screen.getByTestId('kept-strip')).toBeOnTheScreen();

    await user.press(screen.getByTestId('keep-kept-0'));

    expect(screen.queryByTestId('kept-strip')).toBeNull();
  });

  it('adjusts the newest lines with Shorter, sending the lines being adjusted', async () => {
    const { calls, user } = await setup({ outputs: [lines('Casual'), lines('Short')] });
    await press(user, 'Use latest screenshot');
    await press(user, 'Flirty');
    await press(user, 'Get lines');
    await screen.findByText('Casual one');

    await press(user, 'Shorter');
    await screen.findByText('Short one');

    expect(calls[1].prompt).toMatchObject({
      tone: { label: 'Flirty' },
      adjustment: { kind: 'shorter', previousLines: ['Casual one', 'Casual two', 'Casual three'] },
    });
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Flirty · Story reply · Shorter');
    expect(screen.getByText('Casual one')).toBeOnTheScreen();
  });

  it('starts over when another screenshot is chosen', async () => {
    const { user } = await setup();
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');
    await screen.findByText('Casual one');
    await user.press(screen.getByTestId('keep-0-0'));

    await press(user, 'Pick another');

    await waitFor(() => expect(screen.queryByText('Casual one')).toBeNull());
    expect(screen.queryByTestId('kept-strip')).toBeNull();
    expect(screen.getByRole('button', { name: 'Get lines' })).toBeEnabled();
  });
});

describe('GenerateScreen: Analyse and declines', () => {
  it('hides the tones for Analyse and shows the read, the signals, the advice and one reply', async () => {
    const analysis: ModelOutput = {
      kind: 'analysis',
      username: 'some.one',
      screenType: 'chat',
      noticed: 'Short replies.',
      interest: 'low',
      signals: ['One-word replies', 'No questions back'],
      advice: 'Give it a rest for now.',
      suggestedReply: 'No worries, catch you later.',
    };
    const { calls, user } = await setup({ outputs: [analysis] });
    await press(user, 'Use latest screenshot');

    await press(user, 'Analyse');
    expect(screen.queryByRole('button', { name: 'Flirty' })).toBeNull();
    await press(user, 'Analyse this chat');

    expect(await screen.findByTestId('result-interest-0')).toHaveTextContent('Not much interest');
    expect(screen.getByText('• One-word replies')).toBeOnTheScreen();
    expect(screen.getByText('Give it a rest for now.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'No worries, catch you later.' })).toBeOnTheScreen();
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Analyse');
    expect(calls[0].prompt).toMatchObject({ mode: 'analyse', tone: null });
    // Nothing to shorten or make bolder in an analysis.
    expect(screen.queryByRole('button', { name: 'Shorter' })).toBeNull();
  });

  it('shows the reason when the AI writes no lines for a screenshot', async () => {
    const declined: ModelOutput = {
      kind: 'declined',
      username: null,
      screenType: 'other',
      noticed: '',
      reason: 'This is not an Instagram screenshot.',
    };
    const { user } = await setup({ outputs: [declined] });
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');

    expect(await screen.findByTestId('result-declined-0')).toBeOnTheScreen();
    expect(screen.getByText('This is not an Instagram screenshot.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Shorter' })).toBeNull();
  });
});

describe('GenerateScreen: problems', () => {
  it('asks for a key when there is none', async () => {
    const { user } = await setup({ keys: [] });

    expect(screen.getByTestId('no-key-notice')).toBeOnTheScreen();
    await user.press(screen.getByTestId('no-key-add'));
    expect(mockPush).toHaveBeenCalledWith('/keys/add');
  });

  it('does not count a rejected or switched-off key as usable', async () => {
    await setup({ keys: [makeKey({ id: 'a', status: 'invalid' }), makeKey({ id: 'b', status: 'disabled', key: 'k2' })] });
    expect(screen.getByTestId('no-key-notice')).toBeOnTheScreen();
  });

  it.each([
    ['no_internet', 'No connection. Check your internet and try again.', 'Try again'],
    ['refused', 'The AI declined to answer for this screenshot.', 'Try again'],
    ['unreadable', 'The AI gave an answer Banter could not read. Try again.', 'Try again'],
    ['provider_down', 'The AI provider is having trouble right now. Try again in a moment.', 'Try again'],
    ['limit', 'This key has reached its limit.', 'Manage keys'],
    ['no_credit', 'This key has no credit left. Add credit with the provider, then try again.', 'Manage keys'],
    ['wrong_key', 'This key was rejected. Check it on the Keys screen.', 'Manage keys'],
    ['no_keys', 'Add an AI key to start.', 'Add a key'],
  ] as const)('explains "%s" and offers the right next step', async (kind, message, action) => {
    const { user } = await setup({ outputs: [new EngineError(kind)] });
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');

    expect(await screen.findByTestId('generate-error-message')).toHaveTextContent(message);
    expect(screen.getByTestId('generate-error-action')).toHaveTextContent(action);
  });

  it('keeps the lines already shown when a later generation fails, and can try again', async () => {
    const { user } = await setup({ outputs: [lines('Casual'), new EngineError('no_internet'), lines('Second')] });
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');
    await screen.findByText('Casual one');

    await press(user, 'Get lines in this tone');
    expect(await screen.findByTestId('generate-error')).toBeOnTheScreen();
    expect(screen.getByText('Casual one')).toBeOnTheScreen();

    await user.press(screen.getByTestId('generate-error-action'));
    expect(await screen.findByText('Second one')).toBeOnTheScreen();
    expect(screen.queryByTestId('generate-error')).toBeNull();
  });

  it('never crashes on an error it does not know', async () => {
    const { deps, user } = await setup();
    (deps.runEngine as jest.Mock).mockRejectedValueOnce(new TypeError('something unexpected'));
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');

    expect(await screen.findByTestId('generate-error-message')).toHaveTextContent(
      'The AI gave an answer Banter could not read. Try again.',
    );
  });

  it('explains when Banter cannot see the newest screenshot, and offers the gallery', async () => {
    const { deps, user } = await setup({
      latest: {
        ok: false,
        reason: 'limited_access',
        message: 'Banter can only see the photos you selected, so it cannot find your newest screenshot.',
      },
    });

    await press(user, 'Use latest screenshot');

    expect(await screen.findByTestId('generate-error-message')).toHaveTextContent(/only see the photos you selected/);
    await user.press(screen.getByTestId('generate-error-action'));
    expect(deps.pickFromGallery).toHaveBeenCalled();
    expect(await screen.findByTestId('screenshot-preview')).toBeOnTheScreen();
  });

  it('says nothing when the user just closes the photo picker', async () => {
    const { deps, user } = await setup();
    (deps.pickFromGallery as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'cancelled', message: '' });

    await press(user, 'Pick from gallery');

    await waitFor(() => expect(deps.pickFromGallery).toHaveBeenCalled());
    expect(screen.queryByTestId('generate-error')).toBeNull();
  });

  it('saves a key that hit its limit, so it is skipped and shown on the Keys screen', async () => {
    const { deps, keysRepo, user } = await setup();
    (deps.runEngine as jest.Mock).mockImplementationOnce(async (options: GenerateOptions) => {
      await options.onKeyProblem?.({ keyId: 'key-1', status: 'limited', message: 'This key has reached its limit.' });
      throw new EngineError('limit');
    });
    await press(user, 'Use latest screenshot');
    await press(user, 'Get lines');
    await screen.findByTestId('generate-error');

    expect(keysRepo.repo.update).toHaveBeenCalledWith(
      'key-1',
      expect.objectContaining({ status: 'limited', last_error: 'This key has reached its limit.' }),
    );
    expect(keysRepo.rows()[0].limited_at).toEqual(expect.any(String));
    // With its only key resting, the screen now says there is no usable key.
    expect(await screen.findByTestId('no-key-notice')).toBeOnTheScreen();
  });
});
