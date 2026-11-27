import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { useEffect, useState } from 'react';

import { GenerateScreen } from '@/components/generate/generate-screen';
import { ResultsScreen } from '@/components/generate/results-screen';
import { ToastProvider } from '@/components/ui';
import { EngineError, type GenerateOptions, type GenerationResult, type ModelOutput } from '@/engine';
import { GenerateProvider } from '@/generate/generate-provider';
import type { GenerateDeps } from '@/generate/use-generate';
import type { ScreenshotResult } from '@/screenshot/types';
import {
  TEST_USER_ID,
  createFakeHistoryRepo,
  createFakeKeysRepo,
  createFakeProfileRepo,
  createFakePromptsRepo,
  makeKey,
  makeProfile,
  makeUserPrompt,
  renderWithData,
} from '@/test-utils';

// A stand-in for the navigator: Generate and Results are two screens, and the tests move
// between them the way the app does.
const mockNav = { go: (_route: string) => {} };
const mockPush = jest.fn((route: string) => mockNav.go(route));
const mockBack = jest.fn(() => mockNav.go('back'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

function TwoScreens() {
  const [onResults, setOnResults] = useState(false);
  useEffect(() => {
    mockNav.go = (route) => {
      if (route === '/results') setOnResults(true);
      if (route === 'back') setOnResults(false);
    };
  }, []);
  return onResults ? <ResultsScreen /> : <GenerateScreen />;
}

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
  sentLineStatus: 'unknown',
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
  history?: ReturnType<typeof createFakeHistoryRepo>;
  prompts?: ReturnType<typeof createFakePromptsRepo>;
  settings?: Record<string, unknown>;
  profile?: ReturnType<typeof createFakeProfileRepo>;
};

async function setup({
  outputs = [lines('Casual')],
  keys = [makeKey()],
  latest = SCREENSHOT,
  history = createFakeHistoryRepo(),
  prompts = createFakePromptsRepo(),
  settings = {},
  profile,
}: Setup = {}) {
  const calls: GenerateOptions[] = [];
  const keysRepo = createFakeKeysRepo(keys);
  const deps: GenerateDeps = {
    getLatestScreenshot: jest.fn(async () => latest),
    pickFromGallery: jest.fn(async () => SCREENSHOT),
    copy: jest.fn(async () => true),
    now: () => new Date('2026-11-25T12:00:00Z'),
    runEngine: jest.fn(async (options: GenerateOptions) => {
      calls.push(options);
      const next = outputs[Math.min(calls.length - 1, outputs.length - 1)];
      if (next instanceof EngineError) throw next;
      return result(next);
    }),
  };
  await renderWithData(
    <ToastProvider>
      <GenerateProvider deps={deps}>
        <TwoScreens />
      </GenerateProvider>
    </ToastProvider>,
    {
      keysRepo: keysRepo.repo,
      historyRepo: history.repo,
      promptsRepo: prompts.repo,
      profileRepo: (profile ?? createFakeProfileRepo(makeProfile({ display_name: 'Sam', texting_style: 'short, dry', settings }))).repo,
    },
  );
  // Wait for the keys to load, so the screen knows whether there is one.
  await waitFor(() => expect(keysRepo.repo.list).toHaveBeenCalled());
  await act(async () => {});
  return { deps, calls, keysRepo, history, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

const press = (user: User, name: string) => user.press(screen.getByRole('button', { name }));

/** Chooses the newest screenshot and asks for lines; ends on the Results screen. */
async function firstLines(user: User, text = 'Casual one') {
  await press(user, 'Use latest');
  await press(user, 'Get lines');
  await screen.findByText(text);
}

/** On Results: asks for another set in this tone, through the Tone sheet. */
async function anotherTone(user: User, tone: string) {
  await press(user, 'Tone');
  await press(user, tone);
}

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
});

describe('Generate: getting lines', () => {
  it('cannot generate before a screenshot is chosen', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Get lines' })).toBeDisabled();
    expect(screen.queryByTestId('screenshot-preview')).toBeNull();
    expect(screen.getByTestId('screenshot-empty')).toBeOnTheScreen();
  });

  it('shows the newest screenshot, then opens Results with three lines, what was noticed and the username', async () => {
    const { calls, user } = await setup();

    await press(user, 'Use latest');
    expect(await screen.findByTestId('screenshot-preview')).toBeOnTheScreen();

    await press(user, 'Get lines');

    expect(await screen.findByText('Casual one')).toBeOnTheScreen();
    expect(mockPush).toHaveBeenCalledWith('/results');
    expect(screen.getByTestId('results-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('generate-screen')).toBeNull();
    expect(screen.getByText('Casual two')).toBeOnTheScreen();
    expect(screen.getByText('Casual three')).toBeOnTheScreen();
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Casual · Story reply');
    expect(screen.getByTestId('person-username')).toHaveTextContent('@some.one');
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
    await press(user, 'From gallery');
    await screen.findByTestId('screenshot-preview');

    await press(user, 'Opener');
    await press(user, 'Flirty');
    // "How you know her" is one row; the choices open in a sheet.
    expect(screen.queryByRole('button', { name: 'Stranger' })).toBeNull();
    await user.press(screen.getByTestId('context-row'));
    await press(user, 'Stranger');
    expect(screen.queryByTestId('context-sheet')).toBeNull();
    expect(screen.getByTestId('context-row')).toHaveTextContent(/Stranger/);

    await press(user, 'Get lines');
    await screen.findByTestId('result-set-0');

    expect(calls[0].prompt).toMatchObject({ mode: 'opener', tone: { label: 'Flirty' }, context: 'stranger' });
  });

  it('copies a line when it is tapped, marks it as copied and says so', async () => {
    const { deps, user } = await setup();
    await firstLines(user);

    await user.press(screen.getByRole('button', { name: /^Casual two/ }));

    expect(deps.copy).toHaveBeenCalledWith('Casual two');
    expect(screen.getByTestId('line-status-0-1')).toHaveTextContent('Copied');
    expect(screen.getByTestId('line-status-0-0')).toHaveTextContent('Tap to copy');
    expect(screen.getByTestId('toast')).toHaveTextContent('Copied');
  });

  it('copies with the copy button too', async () => {
    const { deps, user } = await setup();
    await firstLines(user);

    await user.press(screen.getByTestId('copy-0-2'));

    expect(deps.copy).toHaveBeenCalledWith('Casual three');
  });

  it('goes back to Generate with the lines one tap away', async () => {
    const { user } = await setup();
    await firstLines(user);

    await press(user, 'Back');
    expect(screen.getByTestId('generate-screen')).toBeOnTheScreen();
    expect(screen.queryByText('Casual one')).toBeNull();

    await press(user, 'Lines (1)');
    expect(screen.getByText('Casual one')).toBeOnTheScreen();
  });
});

describe('Results: nothing is replaced, and lines can be kept', () => {
  it('shows one set at a time and switches between them with the chips', async () => {
    const { calls, user } = await setup({ outputs: [lines('Casual'), lines('Flirty')] });
    await firstLines(user);
    // One set: nothing to switch between.
    expect(screen.queryByTestId('set-chips')).toBeNull();

    await anotherTone(user, 'Flirty');
    await screen.findByText('Flirty one');

    expect(calls[1].prompt).toMatchObject({ tone: { label: 'Flirty' }, adjustment: null });
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Flirty · Story reply');
    expect(screen.queryByText('Casual one')).toBeNull();
    expect(screen.getByTestId('set-chip-0')).toBeSelected();
    expect(screen.getByTestId('set-chip-0')).toHaveTextContent('Flirty');
    expect(screen.getByTestId('set-chip-1')).toHaveTextContent('Casual');

    await user.press(screen.getByTestId('set-chip-1'));

    expect(screen.getByText('Casual one')).toBeOnTheScreen();
    expect(screen.queryByText('Flirty one')).toBeNull();
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Casual · Story reply');
  });

  it('adds a set from the Generate tab as well, and shows the newest', async () => {
    const { user } = await setup({ outputs: [lines('Casual'), lines('Funny')] });
    await firstLines(user);

    await press(user, 'Back');
    await press(user, 'Funny');
    await press(user, 'Get lines');

    expect(await screen.findByText('Funny one')).toBeOnTheScreen();
    expect(screen.getByTestId('set-chip-1')).toHaveTextContent('Casual');
  });

  it('keeps a line in the Kept sheet, where it stays through later sets', async () => {
    const { deps, user } = await setup({ outputs: [lines('Casual'), lines('Flirty'), lines('Funny')] });
    await firstLines(user, 'Casual two');
    expect(screen.queryByTestId('kept-button')).toBeNull();

    await user.press(screen.getByTestId('keep-0-1'));

    expect(screen.getByTestId('toast')).toHaveTextContent('Saved');
    expect(screen.getByTestId('kept-button')).toHaveTextContent('1');
    await user.press(screen.getByTestId('kept-button'));
    const strip = screen.getByTestId('kept-strip');
    expect(within(strip).getByText('Casual two')).toBeOnTheScreen();
    expect(within(strip).getByText('Casual · Story reply')).toBeOnTheScreen();
    await user.press(screen.getByTestId('sheet-close'));
    expect(screen.queryByTestId('kept-strip')).toBeNull();

    await anotherTone(user, 'Flirty');
    await screen.findByText('Flirty one');
    await anotherTone(user, 'Funny');
    await screen.findByText('Funny one');

    await user.press(screen.getByTestId('kept-button'));
    expect(within(screen.getByTestId('kept-strip')).getByText('Casual two')).toBeOnTheScreen();
    await user.press(screen.getByTestId('line-kept-0'));
    expect(deps.copy).toHaveBeenLastCalledWith('Casual two');
  });

  it('removes a line from Kept when its bookmark is tapped there', async () => {
    const { user } = await setup();
    await firstLines(user);
    await user.press(screen.getByTestId('keep-0-0'));
    await user.press(screen.getByTestId('kept-button'));

    await user.press(screen.getByTestId('keep-kept-0'));

    expect(screen.queryByTestId('kept-strip')).toBeNull();
    expect(screen.queryByTestId('kept-button')).toBeNull();
  });

  it('adjusts the lines with Shorter, sending the lines being adjusted', async () => {
    const { calls, user } = await setup({ outputs: [lines('Casual'), lines('Short')] });
    await press(user, 'Use latest');
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
    expect(screen.getByTestId('set-chip-0')).toHaveTextContent('Flirty · Shorter');
  });

  it('adjusts the set being looked at, not just the newest', async () => {
    const { calls, user } = await setup({ outputs: [lines('Casual'), lines('Flirty'), lines('Bold')] });
    await firstLines(user);
    await anotherTone(user, 'Flirty');
    await screen.findByText('Flirty one');

    await user.press(screen.getByTestId('set-chip-1'));
    await press(user, 'Bolder');
    await screen.findByText('Bold one');

    expect(calls[2].prompt).toMatchObject({
      tone: { label: 'Casual' },
      adjustment: { kind: 'bolder', previousLines: ['Casual one', 'Casual two', 'Casual three'] },
    });
  });

  it('starts over when another screenshot is chosen', async () => {
    const { user } = await setup();
    await firstLines(user);
    await user.press(screen.getByTestId('keep-0-0'));
    await press(user, 'Back');
    expect(screen.getByRole('button', { name: 'Lines (1)' })).toBeOnTheScreen();

    await press(user, 'From gallery');

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lines (1)' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Get lines' })).toBeEnabled();
  });

  it('clears the screenshot and its lines with the clear button, keeping mode and tone', async () => {
    const { calls, history, user } = await setup({ outputs: [lines('Flirty'), lines('Next')] });
    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');
    await press(user, 'Opener');
    await press(user, 'Flirty');
    await press(user, 'Get lines');
    await screen.findByText('Flirty one');
    await press(user, 'Back');
    expect(screen.getByRole('button', { name: 'Lines (1)' })).toBeOnTheScreen();

    await user.press(screen.getByTestId('clear-screenshot'));

    expect(screen.getByTestId('screenshot-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('clear-screenshot')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lines (1)' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Get lines' })).toBeDisabled();
    // The lines were saved when they arrived; clearing does not touch them.
    await waitFor(() => expect(history.lines).toHaveLength(3));
    expect(history.repo.deletePerson).not.toHaveBeenCalled();
    // Mode and tone are habits, not part of the screenshot.
    expect(screen.getByRole('button', { name: 'Opener' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Flirty' })).toBeSelected();

    // The next screenshot starts fresh: nothing from the last one goes into its prompt.
    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');
    await press(user, 'Get lines');
    await screen.findByText('Next one');
    expect(calls[1].prompt.memory).toEqual([]);
    expect(screen.queryByTestId('set-chips')).toBeNull();
  });
});

describe('Generate: Analyse and declines', () => {
  it('hides the tones for Analyse and shows the read, the signals, the advice and one reply', async () => {
    const analysis: ModelOutput = {
      kind: 'analysis',
      username: 'some.one',
      screenType: 'chat',
      noticed: 'Short replies.',
      sentLineStatus: 'unknown',
      interest: 'low',
      signals: ['One-word replies', 'No questions back'],
      advice: 'Give it a rest for now.',
      suggestedReply: 'No worries, catch you later.',
    };
    const { calls, user } = await setup({ outputs: [analysis] });
    await press(user, 'Use latest');

    await press(user, 'Analyse');
    expect(screen.queryByRole('button', { name: 'Flirty' })).toBeNull();
    await press(user, 'Analyse this chat');

    expect(await screen.findByTestId('result-interest-0')).toHaveTextContent('Not much interest');
    expect(screen.getByText('• One-word replies')).toBeOnTheScreen();
    expect(screen.getByText('Give it a rest for now.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^No worries, catch you later\./ })).toBeOnTheScreen();
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Analyse');
    expect(calls[0].prompt).toMatchObject({ mode: 'analyse', tone: null });
    // Nothing to shorten, make bolder or change the tone of in an analysis.
    expect(screen.queryByRole('button', { name: 'Shorter' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tone' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Again' })).toBeOnTheScreen();
  });

  it('shows the reason when the AI writes no lines for a screenshot', async () => {
    const declined: ModelOutput = {
      kind: 'declined',
      username: null,
      screenType: 'other',
      noticed: '',
      sentLineStatus: 'unknown',
      reason: 'This is not an Instagram screenshot.',
    };
    const { user } = await setup({ outputs: [declined] });
    await press(user, 'Use latest');
    await press(user, 'Get lines');

    expect(await screen.findByTestId('result-declined-0')).toBeOnTheScreen();
    expect(screen.getByText('This is not an Instagram screenshot.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Shorter' })).toBeNull();
  });
});

describe('Generate: problems', () => {
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
  ] as const)('explains "%s" on Results, where the lines were asked for, with the right next step', async (kind, message, action) => {
    const { user } = await setup({ outputs: [new EngineError(kind)] });
    await press(user, 'Use latest');
    await press(user, 'Get lines');

    expect(await screen.findByTestId('generate-error-message')).toHaveTextContent(message);
    expect(screen.getByTestId('generate-error-action')).toHaveTextContent(action);
    expect(screen.getByTestId('results-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('results-empty')).toBeNull();

    // Back on the Generate tab the screenshot is still chosen, and the failure is not repeated there.
    await press(user, 'Back');
    expect(screen.getByTestId('screenshot-preview')).toBeOnTheScreen();
    expect(screen.queryByTestId('generate-error')).toBeNull();
  });

  it('opens Results on the tap and shows the wait until the lines arrive', async () => {
    const { deps, user } = await setup();
    let finish: (value: GenerationResult) => void = () => {};
    (deps.runEngine as jest.Mock).mockImplementationOnce(
      () => new Promise<GenerationResult>((resolve) => (finish = resolve)),
    );
    await press(user, 'Use latest');

    await press(user, 'Get lines');

    expect(mockPush).toHaveBeenCalledWith('/results');
    expect(await screen.findByTestId('results-loading')).toBeOnTheScreen();
    expect(screen.getByText('Reading the screenshot…')).toBeOnTheScreen();

    await act(async () => finish(result(lines('Casual'))));

    expect(await screen.findByText('Casual one')).toBeOnTheScreen();
    expect(screen.queryByTestId('results-loading')).toBeNull();
  });

  it('cannot ask twice while the first request is running', async () => {
    const { deps, user } = await setup();
    let finish: (value: GenerationResult) => void = () => {};
    (deps.runEngine as jest.Mock).mockImplementationOnce(
      () => new Promise<GenerationResult>((resolve) => (finish = resolve)),
    );
    await press(user, 'Use latest');
    await press(user, 'Get lines');
    await screen.findByTestId('results-loading');

    await press(user, 'Back');
    expect(screen.getByRole('button', { name: 'Get lines' })).toBeDisabled();

    await act(async () => finish(result(lines('Casual'))));
    expect(await screen.findByRole('button', { name: 'Lines (1)' })).toBeOnTheScreen();
    expect(deps.runEngine).toHaveBeenCalledTimes(1);
  });

  it('opens Results when Try again works', async () => {
    const { user } = await setup({ outputs: [new EngineError('provider_down'), lines('Casual')] });
    await press(user, 'Use latest');
    await press(user, 'Get lines');

    await user.press(await screen.findByTestId('generate-error-action'));

    expect(await screen.findByText('Casual one')).toBeOnTheScreen();
    expect(screen.getByTestId('results-screen')).toBeOnTheScreen();
  });

  it('keeps the lines already shown when a later request fails, and Try again repeats that request', async () => {
    const { calls, user } = await setup({ outputs: [lines('Casual'), new EngineError('no_internet'), lines('Second')] });
    await firstLines(user);

    await press(user, 'Bolder');
    expect(await screen.findByTestId('generate-error')).toBeOnTheScreen();
    expect(screen.getByText('Casual one')).toBeOnTheScreen();

    await user.press(screen.getByTestId('generate-error-action'));
    expect(await screen.findByText('Second one')).toBeOnTheScreen();
    expect(screen.queryByTestId('generate-error')).toBeNull();
    expect(calls[2].prompt.adjustment).toMatchObject({ kind: 'bolder' });
  });

  it('never crashes on an error it does not know', async () => {
    const { deps, user } = await setup();
    (deps.runEngine as jest.Mock).mockRejectedValueOnce(new TypeError('something unexpected'));
    await press(user, 'Use latest');
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

    await press(user, 'Use latest');

    expect(await screen.findByTestId('generate-error-message')).toHaveTextContent(/only see the photos you selected/);
    await user.press(screen.getByTestId('generate-error-action'));
    expect(deps.pickFromGallery).toHaveBeenCalled();
    expect(await screen.findByTestId('screenshot-preview')).toBeOnTheScreen();
  });

  it('says nothing when the user just closes the photo picker', async () => {
    const { deps, user } = await setup();
    (deps.pickFromGallery as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'cancelled', message: '' });

    await press(user, 'From gallery');

    await waitFor(() => expect(deps.pickFromGallery).toHaveBeenCalled());
    expect(screen.queryByTestId('generate-error')).toBeNull();
  });

  it('saves a model that hit its limit, so the next request starts with another', async () => {
    const { deps, keysRepo, user } = await setup();
    (deps.runEngine as jest.Mock).mockImplementationOnce(async (options: GenerateOptions) => {
      await options.onKeyProblem?.({
        keyId: 'key-1',
        model: 'gemini-3.5-flash-lite',
        scope: 'model',
        status: 'limited',
        message: 'This key has reached its limit.',
        limit: { retryAfterMs: 30_000 },
      });
      throw new EngineError('limit');
    });
    await press(user, 'Use latest');
    await press(user, 'Get lines');
    await screen.findByTestId('generate-error');
    await press(user, 'Back');

    expect(keysRepo.repo.update).toHaveBeenCalledWith('key-1', {
      model_limits: { 'gemini-3.5-flash-lite': expect.any(String) },
    });
    // The key itself is fine: it stays usable, its other models (and this one later) answer.
    expect(keysRepo.rows()[0].status).toBe('active');
    expect(screen.queryByTestId('no-key-notice')).toBeNull();
  });

  it('saves a key that ran out of credit, so it is skipped and shown on the Keys screen', async () => {
    const { deps, keysRepo, user } = await setup();
    (deps.runEngine as jest.Mock).mockImplementationOnce(async (options: GenerateOptions) => {
      await options.onKeyProblem?.({
        keyId: 'key-1',
        model: 'gemini-3.5-flash-lite',
        scope: 'key',
        status: 'limited',
        message: 'This key has no credit left.',
      });
      throw new EngineError('no_credit');
    });
    await press(user, 'Use latest');
    await press(user, 'Get lines');
    await screen.findByTestId('generate-error');
    await press(user, 'Back');

    expect(keysRepo.repo.update).toHaveBeenCalledWith(
      'key-1',
      expect.objectContaining({ status: 'limited', last_error: 'This key has no credit left.' }),
    );
    expect(keysRepo.rows()[0].limited_at).toEqual(expect.any(String));
    // With its only key resting, the screen now says there is no usable key.
    expect(await screen.findByTestId('no-key-notice')).toBeOnTheScreen();
  });

  it('says so on Results when it is opened with no lines', async () => {
    await setup();
    await act(async () => mockNav.go('/results'));
    expect(screen.getByTestId('results-empty')).toBeOnTheScreen();
  });
});

describe('Generate: history', () => {
  it('saves the generation: the person, the screenshot, the interaction and its lines', async () => {
    const { history, user } = await setup();
    await firstLines(user);

    await waitFor(() => expect(history.lines).toHaveLength(3));
    expect(history.people.map((person) => person.username)).toEqual(['some.one']);
    expect(history.interactions[0]).toMatchObject({
      person_id: 'person-1',
      mode_id: 'story_reply',
      tone_id: 'casual',
      tone_label: 'Casual',
      screen_type: 'story',
      noticed: 'A bowl of pho.',
      provider: 'gemini',
      model: 'gemini-3.5-flash-lite',
      api_key_id: 'key-1',
      api_key_label: 'Main',
      prompt_version: 4,
      duration_ms: 2000,
      parent_id: null,
    });
    expect(history.lines.map((line) => [line.position, line.text, line.hook])).toEqual([
      [1, 'Casual one', 'the broth'],
      [2, 'Casual two', 'table 24'],
      [3, 'Casual three', 'the herbs'],
    ]);
    // Stored in the user's own folder, and that is where the interaction points.
    const [path] = [...history.files.keys()];
    expect(path).toMatch(new RegExp(`^${TEST_USER_ID}/[0-9a-f-]{36}\\.jpg$`));
    expect(history.interactions[0].screenshot_path).toBe(path);
    expect(screen.getByTestId('person-username')).toHaveTextContent('@some.one');
  });

  it('puts the first interaction into the second prompt, so lines are not repeated', async () => {
    const { calls, history, user } = await setup({ outputs: [lines('Casual'), lines('Flirty')] });
    await firstLines(user);
    // The first prompt had nothing to remember.
    expect(calls[0].prompt.memory).toEqual([]);

    await user.press(screen.getByRole('button', { name: /^Casual two/ }));
    await waitFor(() => expect(history.lines.find((line) => line.text === 'Casual two')?.copied_at).not.toBeNull());

    await anotherTone(user, 'Flirty');
    await screen.findByText('Flirty one');

    expect(calls[1].prompt.memory).toEqual([
      {
        at: '2026-11-25T12:00:00.000Z',
        modeLabel: 'Story reply',
        toneLabel: 'Casual',
        // Same screenshot: he is still choosing, so the copied line is not "waiting for a reply".
        sameScreenshot: true,
        lines: [
          { text: 'Casual one', copied: false, result: null, awaitingReply: false },
          { text: 'Casual two', copied: true, result: null, awaitingReply: false },
          { text: 'Casual three', copied: false, result: null, awaitingReply: false },
        ],
      },
    ]);
    // Both sets share one stored screenshot.
    expect(history.repo.uploadScreenshot).toHaveBeenCalledTimes(1);
    expect(new Set(history.interactions.map((row) => row.screenshot_path)).size).toBe(1);
  });

  it('does not store the screenshot when saving screenshots is turned off', async () => {
    const { history, user } = await setup({
      outputs: [lines('Casual'), lines('Flirty')],
      settings: { save_screenshots: false },
    });
    await firstLines(user);
    await anotherTone(user, 'Flirty');
    await screen.findByText('Flirty one');

    await waitFor(() => expect(history.interactions).toHaveLength(2));
    expect(history.repo.uploadScreenshot).not.toHaveBeenCalled();
    expect(history.files.size).toBe(0);
    // The lines are saved all the same, and the two sets still belong together.
    expect(history.lines).toHaveLength(6);
    expect(history.interactions[0].screenshot_path).toBeTruthy();
    expect(history.interactions[1].screenshot_path).toBe(history.interactions[0].screenshot_path);
  });

  it('records which set an adjustment came from', async () => {
    const { history, user } = await setup({ outputs: [lines('Casual'), lines('Short')] });
    await firstLines(user);
    await press(user, 'Shorter');
    await screen.findByText('Short one');

    await waitFor(() => expect(history.interactions).toHaveLength(2));
    const [first, second] = history.interactions;
    expect(second).toMatchObject({ parent_id: first.id, adjustment: 'shorter' });
  });

  it('saves Keep, and saves its removal', async () => {
    const { history, user } = await setup();
    await firstLines(user);
    const saved = () => history.lines.find((line) => line.text === 'Casual one');

    await user.press(screen.getByTestId('keep-0-0'));
    await waitFor(() => expect(saved()?.kept_at).toBe('2026-11-25T12:00:00.000Z'));

    await user.press(screen.getByTestId('keep-0-0'));
    await waitFor(() => expect(saved()?.kept_at).toBeNull());
  });

  it('lets the user correct the username, and moves what was saved to that person', async () => {
    const { history, user } = await setup();
    await firstLines(user);
    await waitFor(() => expect(history.interactions).toHaveLength(1));

    await press(user, 'Change username');
    await user.clear(screen.getByLabelText('Her Instagram username'));
    await user.type(screen.getByLabelText('Her Instagram username'), '@The.Right_One');
    await press(user, 'Save');

    expect(screen.getByTestId('person-username')).toHaveTextContent('@the.right_one');
    await waitFor(() => {
      const right = history.people.find((person) => person.username === 'the.right_one');
      expect(right).toBeDefined();
      expect(history.interactions[0].person_id).toBe(right?.id);
    });
    // The misread username does not stay behind as an empty person.
    await waitFor(() => expect(history.people.map((person) => person.username)).toEqual(['the.right_one']));
  });

  it('refuses a username Instagram would not allow', async () => {
    const { history, user } = await setup();
    await firstLines(user);

    await press(user, 'Change username');
    await user.clear(screen.getByLabelText('Her Instagram username'));
    await user.type(screen.getByLabelText('Her Instagram username'), 'two words');
    await press(user, 'Save');

    expect(screen.getByText(/Use only letters, numbers, dots and underscores/)).toBeOnTheScreen();
    expect(history.repo.assignPerson).not.toHaveBeenCalled();
  });

  it('offers to add a username when the AI could not read one', async () => {
    const unread = { ...lines('Casual'), username: null };
    const { history, user } = await setup({ outputs: [unread] });
    await firstLines(user);

    expect(screen.getByTestId('person-username')).toHaveTextContent('No username read');
    await waitFor(() => expect(history.interactions).toHaveLength(1));
    expect(history.interactions[0].person_id).toBeNull();

    await press(user, 'Add username');
    await user.type(screen.getByLabelText('Her Instagram username'), 'found.her');
    await press(user, 'Save');

    await waitFor(() => expect(history.interactions[0].person_id).not.toBeNull());
  });

  it('does not take a reply to a line copied for this same screenshot from the AI', async () => {
    // The AI was not told any line is waiting for a reply (the only copied line is from the
    // screenshot being worked on), so whatever it says about one is not used.
    const replied = { ...lines('Next'), sentLineStatus: 'replied' as const };
    const { history, user } = await setup({ outputs: [lines('Casual'), replied] });
    await firstLines(user);
    await user.press(screen.getByRole('button', { name: /^Casual one/ }));
    const sent = () => history.lines.find((line) => line.text === 'Casual one');
    await waitFor(() => expect(sent()?.copied_at).not.toBeNull());

    await press(user, 'Back');
    await press(user, 'Reply');
    await press(user, 'Get lines');
    await screen.findByText('Next one');
    await waitFor(() => expect(history.interactions).toHaveLength(2));

    expect(history.lines.every((line) => line.result === null)).toBe(true);
  });

  it('does not set a result when the screenshot does not show the line', async () => {
    const { history, user } = await setup({ outputs: [lines('Casual'), lines('Next')] });
    await firstLines(user);
    await user.press(screen.getByRole('button', { name: /^Casual one/ }));
    await press(user, 'New lines');
    await screen.findByText('Next one');
    await waitFor(() => expect(history.interactions).toHaveLength(2));

    expect(history.lines.every((line) => line.result === null)).toBe(true);
  });

  it('remembers how the user knows someone and chooses it next time', async () => {
    const history = createFakeHistoryRepo();
    await history.repo.upsertPerson('some.one', 'know_her', '2026-11-20T10:00:00Z');
    const { user } = await setup({ history });
    await waitFor(() => expect(history.repo.listPeople).toHaveBeenCalled());
    await press(user, 'Use latest');
    expect(screen.getByTestId('context-row')).toHaveTextContent('How you know her');

    await press(user, 'Get lines');
    await screen.findByText('Casual one');
    await press(user, 'Back');

    expect(screen.getByTestId('context-row')).toHaveTextContent(/Know her/);
  });

  it('saves a context chosen after the person is known', async () => {
    const { history, user } = await setup();
    await firstLines(user);

    await press(user, 'Back');
    await user.press(screen.getByTestId('context-row'));
    await press(user, 'Mutual follow');

    await waitFor(() => expect(history.people[0]?.context).toBe('mutual_follow'));
  });

  it('shows the lines even when history cannot be saved right now', async () => {
    const { history, user } = await setup();
    await press(user, 'Use latest');
    // Saving fails; reading the user's taste still works.
    history.repo.upsertPerson = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await press(user, 'Get lines');

    expect(await screen.findByText('Casual one')).toBeOnTheScreen();
    expect(screen.queryByTestId('generate-error')).toBeNull();
    expect(history.interactions).toEqual([]);
  });
});

describe('Generate: the user\'s own tones', () => {
  const FLIRTY = makeUserPrompt({ id: 'prompt-flirty', tone_id: 'flirty', content: 'Dry and teasing. Lowercase. Never sexual.' });
  const NERDY = makeUserPrompt({ id: 'prompt-nerdy', label: 'Nerdy', content: 'One small science reference.' });

  it('sends the user\'s own version of a tone, and records which version wrote the lines', async () => {
    const { calls, history, user } = await setup({
      outputs: [lines('Flirty')],
      prompts: createFakePromptsRepo([FLIRTY]),
    });
    await press(user, 'From gallery');
    await screen.findByTestId('screenshot-preview');
    await press(user, 'Flirty');
    await press(user, 'Get lines');
    await screen.findByText('Flirty one');

    expect(calls[0].prompt.tone).toEqual({ label: 'Flirty', definition: 'Dry and teasing. Lowercase. Never sexual.' });
    await waitFor(() => expect(history.interactions).toHaveLength(1));
    expect(history.interactions[0]).toMatchObject({
      tone_id: 'flirty',
      user_prompt_id: 'prompt-flirty',
      tone_label: 'Flirty',
    });
  });

  it('offers a tone the user made, next to Banter\'s, and writes in it', async () => {
    const { calls, history, user } = await setup({
      outputs: [lines('Nerdy')],
      prompts: createFakePromptsRepo([NERDY]),
    });
    await press(user, 'From gallery');
    await screen.findByTestId('screenshot-preview');
    await press(user, 'Nerdy');
    expect(screen.getByRole('button', { name: 'Nerdy' })).toBeSelected();
    await press(user, 'Get lines');
    await screen.findByText('Nerdy one');

    expect(calls[0].prompt.tone).toEqual({ label: 'Nerdy', definition: 'One small science reference.' });
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Nerdy · Story reply');
    await waitFor(() => expect(history.interactions).toHaveLength(1));
    // A tone of the user's own is not one of Banter's: only the link to their row is kept.
    expect(history.interactions[0]).toMatchObject({
      tone_id: null,
      user_prompt_id: 'prompt-nerdy',
      tone_label: 'Nerdy',
    });
  });

  it('offers the user\'s tone in the Tone sheet on Results, and Shorter stays in that tone', async () => {
    const { calls, user } = await setup({
      outputs: [lines('Casual'), lines('Nerdy'), lines('Short')],
      prompts: createFakePromptsRepo([NERDY]),
    });
    await firstLines(user);
    await anotherTone(user, 'Nerdy');
    await screen.findByText('Nerdy one');

    await press(user, 'Shorter');
    await screen.findByText('Short one');

    expect(calls[2].prompt.tone).toEqual({ label: 'Nerdy', definition: 'One small science reference.' });
    expect(calls[2].prompt.adjustment?.kind).toBe('shorter');
  });

  it('uses the default tones and the app\'s own rules when Supabase has nothing newer', async () => {
    const { calls, user } = await setup();
    await firstLines(user);

    expect(calls[0].prompt.core.version).toBeGreaterThanOrEqual(5);
    expect(calls[0].prompt.tone?.definition).toMatch(/Relaxed and low-pressure/);
  });
});

describe('Generate: who she is, before asking', () => {
  /** @close.friend is saved: known in real life, with a note, and one line sent to her before. */
  async function savedFriend(history = createFakeHistoryRepo()) {
    const personId = await history.repo.upsertPerson('close.friend', 'know_her', '2026-11-24T10:00:00Z');
    await history.repo.setPersonNotes('close.friend', 'Close friend, we flirt a lot, she flirts back.');
    await history.repo.saveInteraction({
      id: 'old',
      person_id: personId,
      mode_id: 'story_reply',
      tone_id: 'flirty',
      tone_label: 'Flirty',
      screenshot_path: 'user/old.jpg',
      provider: 'gemini',
      model: 'm',
      created_at: '2026-11-24T10:00:00Z',
    } as Parameters<typeof history.repo.saveInteraction>[0]);
    await history.repo.saveLines([{ id: 'old-l1', interaction_id: 'old', position: 1, text: 'that playlist is dangerous', hook: null }]);
    await history.repo.patchLine('old-l1', { copied_at: '2026-11-24T10:01:00Z' });
    await history.repo.upsertPerson('someone.else', null, '2026-11-20T10:00:00Z');
    return history;
  }

  it('offers the choice only once a screenshot is chosen and someone is saved', async () => {
    const { user } = await setup({ history: await savedFriend() });
    expect(screen.queryByTestId('person-pick-row')).toBeNull();

    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');

    expect(await screen.findByTestId('person-pick-row')).toHaveTextContent('Who is she');
  });

  it('does not offer it to someone with nobody saved yet', async () => {
    const { user } = await setup();
    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');

    expect(screen.queryByTestId('person-pick-row')).toBeNull();
  });

  it('sends her note, how he knows her and what was sent before in the very first request', async () => {
    const { calls, history, user } = await setup({ outputs: [lines('Spicy')], history: await savedFriend() });
    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');

    await user.press(await screen.findByTestId('person-pick-row'));
    expect(screen.getByTestId('person-pick-__new__')).toBeSelected();
    expect(screen.getByTestId('person-pick-close.friend')).toHaveTextContent(/Know her · Has a note/);
    await user.press(screen.getByTestId('person-pick-close.friend'));

    expect(screen.getByTestId('person-pick-row')).toHaveTextContent(/@close.friend/);
    expect(screen.getByTestId('context-row')).toHaveTextContent(/Know her/);

    await press(user, 'Spicy');
    await press(user, 'Get lines');
    await screen.findByText('Spicy one');

    const prompt = calls[0].prompt;
    expect(prompt.aboutHer).toBe('Close friend, we flirt a lot, she flirts back.');
    expect(prompt.context).toBe('know_her');
    expect(prompt.tone?.label).toBe('Spicy');
    expect(prompt.tone?.definition).toMatch(/Bold flirting with real heat/);
    expect(prompt.memory?.[0].lines[0]).toMatchObject({ text: 'that playlist is dangerous', copied: true });
    // Saved under her, even though the AI read another username from the screenshot.
    expect(screen.getByTestId('person-username')).toHaveTextContent('@close.friend');
    await waitFor(() => expect(history.interactions.find((row) => row.id !== 'old')?.person_id).toBe('person-1'));
  });

  it('can go back to letting Banter read the username, before anything is made', async () => {
    const { calls, user } = await setup({ history: await savedFriend() });
    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');
    await user.press(await screen.findByTestId('person-pick-row'));
    await user.press(screen.getByTestId('person-pick-close.friend'));

    await user.press(screen.getByTestId('person-pick-row'));
    await user.press(screen.getByTestId('person-pick-__new__'));
    expect(screen.getByTestId('person-pick-row')).toHaveTextContent('Who is she');

    await press(user, 'Get lines');
    await screen.findByText('Casual one');
    expect(calls[0].prompt.aboutHer).toBeNull();
    expect(calls[0].prompt.memory).toEqual([]);
  });

  it('moves the lines already made to her when she is picked afterwards', async () => {
    const { history, user } = await setup({ outputs: [lines('Casual')], history: await savedFriend() });
    await firstLines(user);
    await press(user, 'Back');

    await user.press(screen.getByTestId('person-pick-row'));
    // The lines are saved under someone now: "Someone new" is no longer offered.
    expect(screen.queryByTestId('person-pick-__new__')).toBeNull();
    await user.press(screen.getByTestId('person-pick-close.friend'));

    await waitFor(() =>
      expect(history.interactions.filter((row) => row.id !== 'old').every((row) => row.person_id === 'person-1')).toBe(true),
    );
  });
});

describe('Generate: choosing which tones show', () => {
  const chips = () =>
    screen
      .getAllByRole('button')
      .filter((button) => button.props.testID?.startsWith('tone-') && button.props.testID !== 'tone-all')
      .map((button) => button.props.testID.replace('tone-', ''));

  it('shows every tone at first, with a Tones button that lists them all', async () => {
    const { user } = await setup();
    expect(chips()).toEqual(['casual', 'funny', 'flirty', 'spicy', 'confident', 'safe']);

    await user.press(screen.getByTestId('tone-all'));

    expect(screen.getByTestId('tone-picker-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('tone-option-casual')).toBeOnTheScreen();
    expect(screen.getByTestId('tone-option-safe')).toBeOnTheScreen();
  });

  it('hides a tone from Generate with its eye, and saves the choice', async () => {
    const profile = createFakeProfileRepo(makeProfile({ settings: { save_screenshots: false } }));
    const { user } = await setup({ profile });

    await user.press(screen.getByTestId('tone-all'));
    await user.press(screen.getByTestId('tone-eye-confident'));
    await user.press(screen.getByTestId('tone-eye-safe'));
    await user.press(screen.getByTestId('sheet-close'));

    expect(chips()).toEqual(['casual', 'funny', 'flirty', 'spicy']);
    await waitFor(() =>
      expect(profile.repo.update).toHaveBeenLastCalledWith(expect.any(String), {
        settings: { save_screenshots: false, hidden_tones: ['confident', 'safe'] },
      }),
    );
  });

  it('keeps hidden tones hidden next time, and shows one again with its eye', async () => {
    const profile = createFakeProfileRepo(makeProfile({ settings: { hidden_tones: ['funny', 'safe'] } }));
    const { user } = await setup({ profile });
    await waitFor(() => expect(chips()).toEqual(['casual', 'flirty', 'spicy', 'confident']));

    await user.press(screen.getByTestId('tone-all'));
    expect(screen.getByTestId('tone-eye-funny')).not.toBeSelected();
    await user.press(screen.getByTestId('tone-eye-funny'));
    await user.press(screen.getByTestId('sheet-close'));

    expect(chips()).toEqual(['casual', 'funny', 'flirty', 'spicy', 'confident']);
  });

  it('uses a hidden tone picked from the list, and shows it while it is in use', async () => {
    const profile = createFakeProfileRepo(makeProfile({ settings: { hidden_tones: ['safe'] } }));
    const { calls, user } = await setup({ profile });
    await waitFor(() => expect(chips()).not.toContain('safe'));
    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');

    await user.press(screen.getByTestId('tone-all'));
    await user.press(screen.getByTestId('tone-option-safe'));

    expect(screen.queryByTestId('tone-picker-sheet')).toBeNull();
    expect(chips()[0]).toBe('safe');
    expect(screen.getByTestId('tone-safe')).toBeSelected();
    await press(user, 'Get lines');
    await screen.findByText('Casual one');
    expect(calls[0].prompt.tone?.label).toBe('Safe');
  });

  it('puts the choice back and says so when it cannot be saved', async () => {
    const profile = createFakeProfileRepo(makeProfile());
    const { user } = await setup({ profile });
    await waitFor(() => expect(profile.repo.get).toHaveBeenCalled());
    profile.failNext();

    await user.press(screen.getByTestId('tone-all'));
    await user.press(screen.getByTestId('tone-eye-safe'));

    expect(await screen.findByText('Could not save that. Check your internet.')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByTestId('tone-eye-safe')).toBeSelected());
  });

  it('makes a new tone from the list', async () => {
    const { user } = await setup();

    await user.press(screen.getByTestId('tone-all'));
    await user.press(screen.getByTestId('tone-new'));

    expect(mockPush).toHaveBeenCalledWith('/tones/new');
  });
});

describe('Generate: where to take a chat', () => {
  const read = (prefix: string, text: string): ModelOutput => ({ ...lines(prefix), read: text } as ModelOutput);

  it('offers it only for Reply, and starts at keep it going', async () => {
    const { user } = await setup();
    expect(screen.queryByTestId('direction-row')).toBeNull();

    await press(user, 'Reply');

    expect(screen.getByTestId('direction-row')).toHaveTextContent(/Keep it going/);
  });

  it('turns up the heat: sends it, names the set, and shows where the chat stands', async () => {
    const { calls, history, user } = await setup({
      outputs: [read('Hot', 'She is matching his energy.'), read('Hotter', 'Still with him.')],
    });
    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');
    await press(user, 'Reply');
    await user.press(screen.getByTestId('direction-row'));
    await user.press(screen.getByTestId('direction-heat_up'));
    expect(screen.getByTestId('direction-row')).toHaveTextContent(/Turn up the heat/);

    await press(user, 'Get lines');
    await screen.findByText('Hot one');

    expect(calls[0].prompt.direction).toBe('heat_up');
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Casual · Reply · Turn up the heat');
    expect(screen.getByTestId('result-read-text-0')).toHaveTextContent('She is matching his energy.');
    await waitFor(() => expect(history.interactions).toHaveLength(1));
    expect(history.interactions[0].analysis).toEqual({ direction: 'heat_up', read: 'She is matching his energy.', fix: null });

    // Bolder on that set stays on the heat.
    await press(user, 'Bolder');
    await screen.findByText('Hotter one');
    expect(calls[1].prompt.direction).toBe('heat_up');
  });

  it('goes back to keep it going for the next screenshot', async () => {
    const { user } = await setup();
    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');
    await press(user, 'Reply');
    await user.press(screen.getByTestId('direction-row'));
    await user.press(screen.getByTestId('direction-ask_out'));

    await press(user, 'From gallery');

    await waitFor(() => expect(screen.getByTestId('direction-row')).toHaveTextContent(/Keep it going/));
  });

  it('sends no direction outside Reply', async () => {
    const { calls, user } = await setup();
    await firstLines(user);

    expect(calls[0].prompt.direction).toBeNull();
  });
});

describe('Generate: learning from what the user picks', () => {
  /** Earlier lines with someone else: one answered, one copied, one marked cringe. */
  async function before(history = createFakeHistoryRepo()) {
    const personId = await history.repo.upsertPerson('someone.else', null, '2026-11-20T10:00:00Z');
    await history.repo.saveInteraction({
      id: 'old', person_id: personId, mode_id: 'story_reply', tone_id: 'casual', tone_label: 'Casual',
      screenshot_path: 'user/old.jpg', provider: 'gemini', model: 'm', created_at: '2026-11-20T10:00:00Z',
    } as Parameters<typeof history.repo.saveInteraction>[0]);
    await history.repo.saveLines([
      { id: 'o1', interaction_id: 'old', position: 1, text: 'that playlist is dangerous', hook: null },
      { id: 'o2', interaction_id: 'old', position: 2, text: 'ok you win this round', hook: null },
      { id: 'o3', interaction_id: 'old', position: 3, text: 'you are a vision', hook: null },
    ]);
    await history.repo.patchLine('o1', { copied_at: 't', result: 'replied' });
    await history.repo.patchLine('o2', { copied_at: 't' });
    await history.repo.patchLine('o3', { feedback: 'cringe' });
    return history;
  }

  it('sends the lines the user chose before, and the ones they turned down', async () => {
    const { calls, user } = await setup({ history: await before() });
    await firstLines(user);

    expect(calls[0].prompt.likedLines).toEqual(['that playlist is dangerous', 'ok you win this round']);
    expect(calls[0].prompt.dislikedLines).toEqual([{ text: 'you are a vision', reason: 'cringe' }]);
  });

  it('marks a line as not for me with a reason, saves it, and can take it back', async () => {
    const { history, user } = await setup();
    await firstLines(user);

    await user.press(screen.getByTestId('dislike-0-1'));
    expect(screen.getByTestId('feedback-sheet')).toBeOnTheScreen();
    await user.press(screen.getByTestId('feedback-too_much'));

    expect(screen.getByTestId('line-status-0-1')).toHaveTextContent('Not for me: too much');
    await waitFor(() => expect(history.lines.find((line) => line.position === 2)?.feedback).toBe('too_much'));

    await user.press(screen.getByTestId('dislike-0-1'));
    await user.press(screen.getByTestId('feedback-clear'));
    expect(screen.getByTestId('line-status-0-1')).toHaveTextContent('Tap to copy');
    await waitFor(() => expect(history.lines.find((line) => line.position === 2)?.feedback).toBeNull());
  });
});

describe('Generate: liking a line', () => {
  it('likes a line, saves it, and says so; a "not for me" afterwards replaces the like', async () => {
    const { history, user } = await setup();
    await firstLines(user);

    await user.press(screen.getByTestId('like-0-1'));

    expect(screen.getByTestId('like-0-1')).toHaveAccessibleName('Liked');
    expect(screen.getByTestId('line-status-0-1')).toHaveTextContent('Liked');
    expect(await screen.findByText('Liked. Banter will write more like this.')).toBeOnTheScreen();
    await waitFor(() => expect(history.lines.find((line) => line.position === 2)?.liked_at).toEqual(expect.any(String)));

    await user.press(screen.getByTestId('dislike-0-1'));
    await user.press(screen.getByTestId('feedback-too_much'));
    await user.press(screen.getByTestId('feedback-done'));

    expect(screen.getByTestId('like-0-1')).toHaveAccessibleName('Like');
    expect(screen.getByTestId('line-status-0-1')).toHaveTextContent('Not for me: too much');
    await waitFor(() =>
      expect(history.lines.find((line) => line.position === 2)).toMatchObject({ feedback: 'too_much', liked_at: null }),
    );
  });

  it('takes a like back with a second tap', async () => {
    const { history, user } = await setup();
    await firstLines(user);

    await user.press(screen.getByTestId('like-0-0'));
    await user.press(screen.getByTestId('like-0-0'));

    expect(screen.getByTestId('line-status-0-0')).toHaveTextContent('Tap to copy');
    await waitFor(() => expect(history.lines.find((line) => line.position === 1)?.liked_at).toBeNull());
  });

  it('sends liked lines first among the lines the user chose before', async () => {
    const history = createFakeHistoryRepo();
    await history.repo.saveInteraction({
      id: 'old', person_id: null, mode_id: 'story_reply', tone_id: 'casual', tone_label: 'Casual',
      screenshot_path: 'user/old.jpg', provider: 'gemini', model: 'm', created_at: '2026-11-20T10:00:00Z',
    } as Parameters<typeof history.repo.saveInteraction>[0]);
    await history.repo.saveLines([
      { id: 'o1', interaction_id: 'old', position: 1, text: 'answered one', hook: null },
      { id: 'o2', interaction_id: 'old', position: 2, text: 'liked one', hook: null },
    ]);
    await history.repo.patchLine('o1', { copied_at: 't', result: 'replied' });
    await history.repo.patchLine('o2', { liked_at: '2026-11-21T10:00:00Z' });

    const { calls, user } = await setup({ history });
    await firstLines(user);

    expect(calls[0].prompt.likedLines).toEqual(['liked one', 'answered one']);
  });
});

describe('Generate: fixing a line marked not for me', () => {
  it('offers to fix it for the reason given: too much becomes a softer set', async () => {
    const { calls, history, user } = await setup({ outputs: [lines('Casual'), lines('Soft')] });
    await firstLines(user);

    await user.press(screen.getByTestId('dislike-0-1'));
    await user.press(screen.getByTestId('feedback-too_much'));
    expect(screen.getByTestId('feedback-fix')).toHaveAccessibleName('Get softer lines');
    await user.press(screen.getByTestId('feedback-fix'));
    await screen.findByText('Soft one');

    expect(calls[1].prompt.adjustment).toEqual({
      kind: 'new_lines',
      previousLines: ['Casual one', 'Casual two', 'Casual three'],
      fix: { line: 'Casual two', reason: 'too_much' },
    });
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Casual · Story reply · Softer');
    await waitFor(() => expect(history.interactions).toHaveLength(2));
    expect(history.interactions[1]).toMatchObject({ adjustment: 'new_lines', parent_id: history.interactions[0].id });
  });

  it('fixes too long with Shorter and too tame with Bolder', async () => {
    const { calls, user } = await setup({ outputs: [lines('Casual'), lines('Short'), lines('Bold')] });
    await firstLines(user);

    await user.press(screen.getByTestId('dislike-0-0'));
    await user.press(screen.getByTestId('feedback-too_long'));
    await user.press(screen.getByTestId('feedback-fix'));
    await screen.findByText('Short one');
    expect(calls[1].prompt.adjustment?.kind).toBe('shorter');
    expect(screen.getByTestId('result-heading-0')).toHaveTextContent('Casual · Story reply · Shorter');

    await user.press(screen.getByTestId('dislike-0-2'));
    await user.press(screen.getByTestId('feedback-too_tame'));
    await user.press(screen.getByTestId('feedback-fix'));
    await screen.findByText('Bold one');
    expect(calls[2].prompt.adjustment).toMatchObject({ kind: 'bolder', fix: { line: 'Short three', reason: 'too_tame' } });
  });

  it('can just note it, without a new set', async () => {
    const { calls, user } = await setup();
    await firstLines(user);

    await user.press(screen.getByTestId('dislike-0-0'));
    await user.press(screen.getByTestId('feedback-cringe'));
    await user.press(screen.getByTestId('feedback-done'));

    expect(screen.queryByTestId('feedback-sheet')).toBeNull();
    expect(screen.getByTestId('line-status-0-0')).toHaveTextContent('Not for me: cringe');
    expect(calls).toHaveLength(1);
  });

  it('adjusts a tone from the reasons given on it lately', async () => {
    const history = createFakeHistoryRepo();
    await history.repo.saveInteraction({
      id: 'old', person_id: null, mode_id: 'story_reply', tone_id: 'casual', tone_label: 'Casual',
      screenshot_path: 'user/old.jpg', provider: 'gemini', model: 'm', created_at: '2026-11-20T10:00:00Z',
    } as Parameters<typeof history.repo.saveInteraction>[0]);
    await history.repo.saveLines([
      { id: 'o1', interaction_id: 'old', position: 1, text: 'one', hook: null },
      { id: 'o2', interaction_id: 'old', position: 2, text: 'two', hook: null },
    ]);
    await history.repo.patchLine('o1', { feedback: 'too_long' });
    await history.repo.patchLine('o2', { feedback: 'too_long' });
    const { calls, user } = await setup({ history });

    await firstLines(user);

    expect(calls[0].prompt.toneMarks).toEqual([{ reason: 'too_long', count: 2 }]);
  });
});

describe('Generate: the language of the lines', () => {
  it('writes in English unless the user switches, and remembers the switch', async () => {
    const profile = createFakeProfileRepo(makeProfile({ settings: { save_screenshots: true } }));
    const { calls, user } = await setup({ profile, outputs: [lines('Eng'), lines('Urdu')] });
    expect(screen.getByTestId('language-row')).toHaveTextContent('English');

    await firstLines(user, 'Eng one');
    expect(calls[0].prompt.language).toBe('english');
    await press(user, 'Back');

    await user.press(screen.getByTestId('language-row'));
    expect(screen.getByTestId('language-row')).toHaveTextContent('Roman Urdu');
    await waitFor(() =>
      expect(profile.repo.update).toHaveBeenCalledWith(expect.any(String), {
        settings: { save_screenshots: true, reply_language: 'roman_urdu' },
      }),
    );

    await press(user, 'Get lines');
    await screen.findByText('Urdu one');
    expect(calls[1].prompt.language).toBe('roman_urdu');
  });

  it('starts in Roman Urdu when that was chosen before', async () => {
    const { calls, user } = await setup({
      profile: createFakeProfileRepo(makeProfile({ settings: { reply_language: 'roman_urdu' } })),
    });
    await waitFor(() => expect(screen.getByTestId('language-row')).toHaveTextContent('Roman Urdu'));

    await firstLines(user);

    expect(calls[0].prompt.language).toBe('roman_urdu');
  });
});

describe('Generate: choosing the screenshot', () => {
  it('chooses inside the screenshot area, and can swap it without clearing first', async () => {
    const { deps, user } = await setup();
    expect(screen.getByTestId('screenshot-empty')).toBeOnTheScreen();

    await press(user, 'Use latest');
    await screen.findByTestId('screenshot-preview');
    await press(user, 'From gallery');

    expect(deps.pickFromGallery).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('screenshot-preview')).toBeOnTheScreen();
  });
});
