import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { PersonaliseScreen } from '@/components/tones/personalise-screen';
import { ToneScreen } from '@/components/tones/tone-screen';
import { TonesScreen } from '@/components/tones/tones-screen';
import { DEFAULT_TONES, EngineError, type PersonaliseOptions, type PersonaliseOutput } from '@/engine';
import {
  createFakeHistoryRepo,
  createFakeKeysRepo,
  createFakeProfileRepo,
  createFakePromptsRepo,
  makeKey,
  makeProfile,
  makeUserPrompt,
  renderWithData,
} from '@/test-utils';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
});

const FLIRTY = makeUserPrompt({ id: 'prompt-flirty', tone_id: 'flirty', content: 'Dry and teasing. Never sexual.' });
const NERDY = makeUserPrompt({ id: 'prompt-nerdy', label: 'Nerdy', content: 'One small science reference.' });

describe('TonesScreen', () => {
  async function setup(prompts = createFakePromptsRepo([FLIRTY, NERDY])) {
    await renderWithData(<TonesScreen />, { promptsRepo: prompts.repo });
    await waitFor(() => expect(screen.getByTestId('tone-row-prompt-nerdy')).toBeOnTheScreen());
    return { prompts, user: userEvent.setup() };
  }

  it('lists Banter\'s tones, then the user\'s own, each with what it says', async () => {
    await setup();

    expect(screen.getByTestId('tone-row-casual')).toHaveTextContent(/Casual/);
    expect(screen.getByTestId('tone-row-casual')).toHaveTextContent(/Relaxed and low-pressure/);
    expect(screen.getByTestId('tone-row-casual')).not.toHaveTextContent(/Edited|Yours/);
    // The user's version is what shows, marked as theirs.
    expect(screen.getByTestId('tone-row-flirty')).toHaveTextContent(/Dry and teasing/);
    expect(screen.getByTestId('tone-row-flirty')).toHaveTextContent(/Edited/);
    expect(screen.getByTestId('tone-row-prompt-nerdy')).toHaveTextContent(/Nerdy/);
    expect(screen.getByTestId('tone-row-prompt-nerdy')).toHaveTextContent(/Yours/);
  });

  it('opens a tone, a new tone, and Personalise', async () => {
    const { user } = await setup();

    await user.press(screen.getByTestId('tone-row-flirty'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/tones/[key]', params: { key: 'flirty' } });
    await user.press(screen.getByTestId('add-tone'));
    expect(mockPush).toHaveBeenLastCalledWith('/tones/new');
    await user.press(screen.getByTestId('personalise-row'));
    expect(mockPush).toHaveBeenLastCalledWith('/tones/personalise');
  });

  it('still lists the tones without internet, and says what is shown', async () => {
    const prompts = createFakePromptsRepo([]);
    prompts.repo.loadDefaults = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await renderWithData(<TonesScreen />, { promptsRepo: prompts.repo });

    expect(await screen.findByTestId('tones-offline')).toBeOnTheScreen();
    expect(screen.getByTestId('tone-row-safe')).toBeOnTheScreen();
  });
});

describe('ToneScreen: one of Banter\'s tones', () => {
  async function setup(toneKey: string, rows = [FLIRTY]) {
    const prompts = createFakePromptsRepo(rows);
    await renderWithData(<ToneScreen toneKey={toneKey} />, { promptsRepo: prompts.repo });
    await waitFor(() => expect(prompts.repo.listUserPrompts).toHaveBeenCalled());
    await screen.findByTestId('tone-definition');
    return { prompts, user: userEvent.setup() };
  }

  it('shows Banter\'s definition, with no name to edit, nothing to reset and nothing to save yet', async () => {
    await setup('casual');

    expect(screen.getByTestId('tone-title')).toHaveTextContent('Casual');
    expect(screen.getByTestId('tone-definition')).toHaveDisplayValue(DEFAULT_TONES.casual.definition);
    expect(screen.queryByTestId('tone-name')).toBeNull();
    expect(screen.queryByTestId('tone-reset')).toBeNull();
    expect(screen.queryByTestId('tone-delete')).toBeNull();
    expect(screen.getByTestId('tone-save')).toBeDisabled();
  });

  it('saves the user\'s own version and goes back', async () => {
    const { prompts, user } = await setup('casual', []);

    await user.clear(screen.getByTestId('tone-definition'));
    await user.type(screen.getByTestId('tone-definition'), 'Short and dry. Lowercase.');
    await user.press(screen.getByTestId('tone-save'));

    await waitFor(() => expect(prompts.repo.addToneVersion).toHaveBeenCalledWith('casual', 'Short and dry. Lowercase.'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('changes a version the user already has, instead of adding a second', async () => {
    const { prompts, user } = await setup('flirty');
    await waitFor(() => expect(screen.getByTestId('tone-definition')).toHaveDisplayValue('Dry and teasing. Never sexual.'));

    await user.type(screen.getByTestId('tone-definition'), ' One emoji at most.');
    await user.press(screen.getByTestId('tone-save'));

    await waitFor(() =>
      expect(prompts.repo.update).toHaveBeenCalledWith('prompt-flirty', {
        content: 'Dry and teasing. Never sexual. One emoji at most.',
      }),
    );
    expect(prompts.repo.addToneVersion).not.toHaveBeenCalled();
  });

  it('does not save an empty definition', async () => {
    const { prompts, user } = await setup('casual', []);

    await user.clear(screen.getByTestId('tone-definition'));
    await user.press(screen.getByTestId('tone-save'));

    expect(screen.getByText('Describe how lines in this tone should sound.')).toBeOnTheScreen();
    expect(prompts.repo.addToneVersion).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('asks before resetting, shows what comes back, and does nothing on Cancel', async () => {
    const { prompts, user } = await setup('flirty');
    await screen.findByTestId('tone-reset');

    await user.press(screen.getByTestId('tone-reset'));
    expect(screen.getByText(new RegExp(DEFAULT_TONES.flirty.definition.slice(0, 30)))).toBeOnTheScreen();
    await user.press(screen.getByTestId('dialog-cancel'));

    expect(prompts.repo.remove).not.toHaveBeenCalled();
  });

  it('resets to Banter\'s version after the confirmation', async () => {
    const { prompts, user } = await setup('flirty');
    await screen.findByTestId('tone-reset');

    await user.press(screen.getByTestId('tone-reset'));
    await user.press(screen.getByTestId('dialog-confirm'));

    await waitFor(() => expect(prompts.repo.remove).toHaveBeenCalledWith('prompt-flirty'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(prompts.rows()).toEqual([]);
  });

  it('says why when the save fails, and stays', async () => {
    const { prompts, user } = await setup('casual', []);
    await user.type(screen.getByTestId('tone-definition'), ' More.');
    prompts.failNext();

    await user.press(screen.getByTestId('tone-save'));

    expect(await screen.findByTestId('tone-error')).toHaveTextContent(/No connection/);
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('ToneScreen: the user\'s own tones', () => {
  async function setup(toneKey?: string) {
    const prompts = createFakePromptsRepo([NERDY]);
    await renderWithData(<ToneScreen toneKey={toneKey} />, { promptsRepo: prompts.repo });
    await waitFor(() => expect(prompts.repo.listUserPrompts).toHaveBeenCalled());
    return { prompts, user: userEvent.setup() };
  }

  it('makes a new tone from a name and a definition', async () => {
    const { prompts, user } = await setup();

    await user.type(screen.getByTestId('tone-name'), 'Dry');
    await user.type(screen.getByTestId('tone-definition'), 'Deadpan. No exclamation marks.');
    await user.press(screen.getByTestId('tone-save'));

    await waitFor(() => expect(prompts.repo.addCustomTone).toHaveBeenCalledWith('Dry', 'Deadpan. No exclamation marks.'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('needs a name, and one that is not taken', async () => {
    const { prompts, user } = await setup();
    await screen.findByTestId('tone-name');

    await user.type(screen.getByTestId('tone-definition'), 'Deadpan.');
    await user.press(screen.getByTestId('tone-save'));
    expect(screen.getByText('Give the tone a name.')).toBeOnTheScreen();

    await user.type(screen.getByTestId('tone-name'), 'flirty');
    expect(screen.getByText('You already have a tone with this name.')).toBeOnTheScreen();
    await user.press(screen.getByTestId('tone-save'));

    expect(prompts.repo.addCustomTone).not.toHaveBeenCalled();
  });

  it('renames and rewrites an own tone', async () => {
    const { prompts, user } = await setup('prompt-nerdy');
    await waitFor(() => expect(screen.getByTestId('tone-name')).toHaveDisplayValue('Nerdy'));

    await user.clear(screen.getByTestId('tone-name'));
    await user.type(screen.getByTestId('tone-name'), 'Geeky');
    await user.press(screen.getByTestId('tone-save'));

    await waitFor(() =>
      expect(prompts.repo.update).toHaveBeenCalledWith('prompt-nerdy', {
        label: 'Geeky',
        content: 'One small science reference.',
      }),
    );
  });

  it('asks before deleting an own tone', async () => {
    const { prompts, user } = await setup('prompt-nerdy');
    await screen.findByTestId('tone-delete');

    await user.press(screen.getByTestId('tone-delete'));
    expect(screen.getByText('Delete this tone?')).toBeOnTheScreen();
    await user.press(screen.getByTestId('dialog-cancel'));
    expect(prompts.repo.remove).not.toHaveBeenCalled();

    await user.press(screen.getByTestId('tone-delete'));
    await user.press(screen.getByTestId('dialog-confirm'));
    await waitFor(() => expect(prompts.repo.remove).toHaveBeenCalledWith('prompt-nerdy'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('says so when the tone is gone', async () => {
    await setup('no-such-tone');

    expect(await screen.findByText('Tone not found')).toBeOnTheScreen();
  });
});

describe('PersonaliseScreen', () => {
  const ANSWER: PersonaliseOutput = {
    suggestions: [
      { key: 'flirty', definition: 'Short, lowercase teasing. Never sexual.', reason: 'You copied the short ones.' },
      { key: 'prompt-nerdy', definition: 'One dry science aside.', reason: 'Your dry lines got replies.' },
    ],
    summary: 'Your short lines got replies.',
  };

  /** A history with one set: one line copied and answered, one copied, one left. */
  async function historyWithLines() {
    const history = createFakeHistoryRepo();
    await history.repo.saveInteraction({
      id: 'i1',
      person_id: null,
      parent_id: null,
      adjustment: null,
      mode_id: 'story_reply',
      tone_id: 'flirty',
      tone_label: 'Flirty',
      context: null,
      screenshot_path: null,
      screen_type: 'story',
      noticed: null,
      analysis: null,
      provider: 'gemini',
      model: 'm',
      api_key_id: null,
      api_key_label: null,
      prompt_version: 5,
      duration_ms: 1,
    });
    await history.repo.saveLines([
      { id: 'l1', interaction_id: 'i1', position: 1, text: 'ok that broth looks serious', hook: null, copied_at: '2026-11-25T12:00:00Z', result: 'replied' },
      { id: 'l2', interaction_id: 'i1', position: 2, text: 'is that table 24', hook: null, copied_at: '2026-11-25T12:00:00Z' },
      { id: 'l3', interaction_id: 'i1', position: 3, text: 'What a lovely bowl!', hook: null },
    ]);
    return history;
  }

  type Options = {
    answer?: PersonaliseOutput | EngineError;
    history?: ReturnType<typeof createFakeHistoryRepo>;
    keys?: ReturnType<typeof makeKey>[];
    textingStyle?: string | null;
  };

  async function setup({ answer = ANSWER, history, keys = [makeKey()], textingStyle = 'short, dry' }: Options = {}) {
    const calls: PersonaliseOptions[] = [];
    const prompts = createFakePromptsRepo([NERDY]);
    const suggest = jest.fn(async (options: PersonaliseOptions) => {
      calls.push(options);
      if (answer instanceof EngineError) throw answer;
      return { output: answer, usedKey: { id: 'key-1', label: 'Main', provider: 'gemini' as const, model: 'm' }, durationMs: 1 };
    });
    const keysRepo = createFakeKeysRepo(keys);
    await renderWithData(<PersonaliseScreen deps={{ suggest }} />, {
      promptsRepo: prompts.repo,
      keysRepo: keysRepo.repo,
      historyRepo: (history ?? (await historyWithLines())).repo,
      profileRepo: createFakeProfileRepo(makeProfile({ display_name: 'Sam', city: 'Lahore', texting_style: textingStyle })).repo,
    });
    await waitFor(() => expect(keysRepo.repo.list).toHaveBeenCalled());
    await waitFor(() => expect(prompts.repo.listUserPrompts).toHaveBeenCalled());
    return { calls, prompts, suggest, user: userEvent.setup() };
  }

  it('says what it will read before anything is sent', async () => {
    const { suggest } = await setup();

    expect(await screen.findByTestId('personalise-evidence-text')).toHaveTextContent(
      '2 lines you copied, 1 that got a reply, 0 that did not. "How you text" is filled in.',
    );
    expect(screen.getByText(/No screenshots and no usernames/)).toBeOnTheScreen();
    expect(suggest).not.toHaveBeenCalled();
  });

  it('sends the tones, the style facts and the lines, without the name or the city', async () => {
    const { calls, user } = await setup();
    await screen.findByTestId('personalise-evidence');

    await user.press(screen.getByTestId('personalise-run'));
    await screen.findByTestId('suggestion-flirty');

    const { input } = calls[0];
    expect(input.tones.map((tone) => tone.key)).toEqual(['casual', 'funny', 'flirty', 'confident', 'safe', 'prompt-nerdy']);
    expect(input.profile).toEqual({ age: null, work: null, interests: null, textingStyle: 'short, dry' });
    expect(input.history).toEqual([
      {
        toneLabel: 'Flirty',
        modeLabel: 'Story reply',
        lines: [
          { text: 'ok that broth looks serious', copied: true, kept: false, result: 'replied' },
          { text: 'is that table 24', copied: true, kept: false, result: null },
          { text: 'What a lovely bowl!', copied: false, kept: false, result: null },
        ],
      },
    ]);
    expect(JSON.stringify(input)).not.toMatch(/Sam|Lahore/);
  });

  it('lists the suggestions as short rows and changes nothing by itself', async () => {
    const { prompts, user } = await setup();
    await screen.findByTestId('personalise-evidence');
    await user.press(screen.getByTestId('personalise-run'));

    expect(await screen.findByTestId('personalise-summary')).toHaveTextContent('Your short lines got replies.');
    expect(screen.getByTestId('suggestion-flirty')).toHaveTextContent(/Flirty/);
    expect(screen.getByTestId('suggestion-flirty')).toHaveTextContent(/You copied the short ones/);
    expect(screen.getByTestId('suggestion-prompt-nerdy')).toHaveTextContent(/Nerdy/);
    expect(prompts.repo.addToneVersion).not.toHaveBeenCalled();
    expect(prompts.repo.update).not.toHaveBeenCalled();
  });

  it('shows now against suggested, and saves the suggestion when it is accepted', async () => {
    const { prompts, user } = await setup();
    await screen.findByTestId('personalise-evidence');
    await user.press(screen.getByTestId('personalise-run'));
    await user.press(await screen.findByTestId('suggestion-flirty'));

    expect(screen.getByTestId('suggestion-current')).toHaveTextContent(DEFAULT_TONES.flirty.definition);
    expect(screen.getByTestId('suggestion-proposed')).toHaveTextContent('Short, lowercase teasing. Never sexual.');

    await user.press(screen.getByTestId('suggestion-accept'));

    await waitFor(() =>
      expect(prompts.repo.addToneVersion).toHaveBeenCalledWith('flirty', 'Short, lowercase teasing. Never sexual.'),
    );
    await waitFor(() => expect(screen.queryByTestId('suggestion-accept')).toBeNull());
    expect(screen.getByTestId('suggestion-flirty')).toHaveTextContent(/Accepted/);
  });

  it('accepts a suggestion for a tone the user made, keeping its name', async () => {
    const { prompts, user } = await setup();
    await screen.findByTestId('personalise-evidence');
    await user.press(screen.getByTestId('personalise-run'));
    await user.press(await screen.findByTestId('suggestion-prompt-nerdy'));
    await user.press(screen.getByTestId('suggestion-accept'));

    await waitFor(() =>
      expect(prompts.repo.update).toHaveBeenCalledWith('prompt-nerdy', { label: 'Nerdy', content: 'One dry science aside.' }),
    );
  });

  it('skips a suggestion without saving anything', async () => {
    const { prompts, user } = await setup();
    await screen.findByTestId('personalise-evidence');
    await user.press(screen.getByTestId('personalise-run'));
    await user.press(await screen.findByTestId('suggestion-flirty'));
    await user.press(screen.getByTestId('suggestion-skip'));

    expect(screen.getByTestId('suggestion-flirty')).toHaveTextContent(/Skipped/);
    expect(prompts.repo.addToneVersion).not.toHaveBeenCalled();
  });

  it('keeps the sheet open and says why when accepting cannot be saved', async () => {
    const { prompts, user } = await setup();
    await screen.findByTestId('personalise-evidence');
    await user.press(screen.getByTestId('personalise-run'));
    await user.press(await screen.findByTestId('suggestion-flirty'));
    prompts.failNext();
    await user.press(screen.getByTestId('suggestion-accept'));

    expect(await screen.findByTestId('suggestion-error')).toHaveTextContent(/No connection/);
    expect(screen.getByTestId('suggestion-accept')).toBeOnTheScreen();
  });

  it('says so when the AI suggests nothing', async () => {
    const { user } = await setup({ answer: { suggestions: [], summary: 'Mark which lines got replies.' } });
    await screen.findByTestId('personalise-evidence');
    await user.press(screen.getByTestId('personalise-run'));

    expect(await screen.findByTestId('personalise-none')).toBeOnTheScreen();
    expect(screen.getByTestId('personalise-summary')).toHaveTextContent('Mark which lines got replies.');
    await user.press(screen.getByTestId('personalise-done'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('explains a failed request and can be tried again', async () => {
    const { suggest, user } = await setup({ answer: new EngineError('no_internet') });
    await screen.findByTestId('personalise-evidence');
    await user.press(screen.getByTestId('personalise-run'));

    expect(await screen.findByTestId('personalise-error')).toBeOnTheScreen();
    expect(screen.getByTestId('personalise-run')).toBeEnabled();
    await user.press(screen.getByTestId('personalise-run'));
    expect(suggest).toHaveBeenCalledTimes(2);
  });

  it('does not ask when there is nothing to read, and points to About you', async () => {
    const { suggest, user } = await setup({ history: createFakeHistoryRepo(), textingStyle: null });

    expect(await screen.findByTestId('personalise-not-enough')).toBeOnTheScreen();
    expect(screen.getByTestId('personalise-run')).toBeDisabled();
    await user.press(screen.getByTestId('personalise-open-profile'));
    expect(mockPush).toHaveBeenCalledWith('/profile');
    expect(suggest).not.toHaveBeenCalled();
  });

  it('can go on "How you text" alone, with no history yet', async () => {
    await setup({ history: createFakeHistoryRepo() });

    expect(await screen.findByTestId('personalise-evidence-text')).toHaveTextContent(/0 lines you copied/);
    expect(screen.queryByTestId('personalise-not-enough')).toBeNull();
    expect(screen.getByTestId('personalise-run')).toBeEnabled();
  });

  it('needs a working key', async () => {
    await setup({ keys: [makeKey({ status: 'invalid' })] });

    expect(await screen.findByTestId('personalise-no-key')).toBeOnTheScreen();
    expect(screen.getByTestId('personalise-run')).toBeDisabled();
  });

  it('says so when the history cannot be read, and reads it again on request', async () => {
    const history = await historyWithLines();
    history.failNext();
    // The provider itself reads the people list first; let that one fail instead.
    const { user } = await setup({ history });

    // Whichever request failed, the screen ends up with the evidence after a retry.
    if (screen.queryByTestId('personalise-history-error')) {
      await user.press(screen.getByRole('button', { name: 'Try again' }));
    }
    expect(await screen.findByTestId('personalise-evidence')).toBeOnTheScreen();
  });
});
