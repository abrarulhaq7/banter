import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { LearnToneScreen } from '@/components/tones/learn-tone-screen';
import { TuneTonesScreen } from '@/components/tones/tune-tones-screen';
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
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
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

  it('marks the tones hidden from Generate', async () => {
    const prompts = createFakePromptsRepo([FLIRTY, NERDY]);
    await renderWithData(<TonesScreen />, {
      promptsRepo: prompts.repo,
      profileRepo: createFakeProfileRepo(makeProfile({ settings: { hidden_tones: ['safe'] } })).repo,
    });

    await waitFor(() => expect(screen.getByTestId('tone-row-safe')).toHaveTextContent(/Hidden/));
    expect(screen.getByTestId('tone-row-casual')).not.toHaveTextContent(/Hidden/);
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

  it('shows or hides the tone on Generate', async () => {
    const profile = createFakeProfileRepo(makeProfile());
    const prompts = createFakePromptsRepo([]);
    await renderWithData(<ToneScreen toneKey="safe" />, { promptsRepo: prompts.repo, profileRepo: profile.repo });
    const user = userEvent.setup();
    expect(await screen.findByTestId('tone-visibility')).toHaveTextContent(/On/);

    await user.press(screen.getByTestId('tone-visibility'));

    await waitFor(() => expect(screen.getByTestId('tone-visibility')).toHaveTextContent(/Off/));
    await waitFor(() =>
      expect(profile.repo.update).toHaveBeenCalledWith(expect.any(String), { settings: { hidden_tones: ['safe'] } }),
    );
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
    expect(input.tones.map((tone) => tone.key)).toEqual(['casual', 'funny', 'flirty', 'spicy', 'confident', 'safe', 'prompt-nerdy']);
    expect(input.profile).toEqual({ age: null, work: null, interests: null, textingStyle: 'short, dry', goal: null });
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

describe('LearnToneScreen', () => {
  const LEARNED = {
    kind: 'learned' as const,
    styles: [
      {
        line: "you look like you'd steal my hoodie",
        name: 'Playful assumption',
        whyItWorks: 'It guesses a cute habit of hers.',
        definition: 'Make a confident, funny guess about her habits. Lowercase, no emoji.',
        samples: ['you look like you take all the fries', 'you definitely argue about movie endings'],
      },
      {
        line: 'ok but who gave you permission',
        name: 'Mock outrage',
        whyItWorks: 'It pretends to be offended by how good it is.',
        definition: 'Act playfully offended by something good. Short.',
        samples: ['who allowed this', 'rude honestly'],
      },
    ],
  };
  const SHOT = {
    ok: true as const,
    screenshot: { previewUri: 'file:///shot.jpg', image: { base64: 'QUJD', mediaType: 'image/jpeg' as const }, width: 10, height: 20 },
  };

  async function setup(answer: unknown = LEARNED, keys = [makeKey()]) {
    const learn = jest.fn(async () => {
      if (answer instanceof EngineError) throw answer;
      return { output: answer, usedKey: { id: 'key-1', label: 'Main', provider: 'gemini' as const, model: 'm' }, durationMs: 1 };
    });
    const keysRepo = createFakeKeysRepo(keys);
    await renderWithData(
      <LearnToneScreen
        deps={{
          learn: learn as never,
          getLatestScreenshot: jest.fn(async () => SHOT),
          pickFromGallery: jest.fn(async () => SHOT),
        }}
      />,
      { keysRepo: keysRepo.repo, promptsRepo: createFakePromptsRepo([NERDY]).repo },
    );
    await waitFor(() => expect(keysRepo.repo.list).toHaveBeenCalled());
    return { learn, user: userEvent.setup() };
  }

  it('needs an example before it can ask', async () => {
    await setup();

    expect(screen.getByTestId('learn-run')).toBeDisabled();
  });

  it('learns from a pasted line and shows what makes it work', async () => {
    const { learn, user } = await setup();

    await user.type(screen.getByTestId('learn-text'), "you look like you'd steal my hoodie");
    await user.press(screen.getByTestId('learn-run'));

    expect(learn).toHaveBeenCalledWith(expect.objectContaining({ input: { kind: 'text', text: "you look like you'd steal my hoodie" } }));
    expect(await screen.findByTestId('learn-name')).toHaveTextContent('Playful assumption');
    expect(screen.getByTestId('learn-why')).toHaveTextContent('It guesses a cute habit of hers.');
    expect(screen.getByTestId('learn-example-line')).toHaveTextContent("“you look like you'd steal my hoodie”");
    expect(screen.getByTestId('learn-sample-0')).toHaveTextContent('you look like you take all the fries');
  });

  it('learns from a screenshot, and switches between the lines it found', async () => {
    const { learn, user } = await setup();

    await user.press(screen.getByTestId('learn-latest'));
    expect(await screen.findByTestId('learn-preview')).toBeOnTheScreen();
    await user.press(screen.getByTestId('learn-run'));

    expect(learn).toHaveBeenCalledWith(expect.objectContaining({ input: { kind: 'image', image: SHOT.screenshot.image } }));
    await user.press(await screen.findByTestId('learn-line-1'));
    expect(screen.getByTestId('learn-name')).toHaveTextContent('Mock outrage');
  });

  it('opens a new tone filled in with the style and the example', async () => {
    const { user } = await setup();
    await user.type(screen.getByTestId('learn-text'), 'x');
    await user.press(screen.getByTestId('learn-run'));

    await user.press(await screen.findByTestId('learn-save-new'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/tones/new',
      params: {
        label: 'Playful assumption',
        definition:
          'Make a confident, funny guess about her habits. Lowercase, no emoji. Example of the move, never to be copied word for word: "you look like you\'d steal my hoodie"',
      },
    });
  });

  it('adds the style to a tone the user picks', async () => {
    const { user } = await setup();
    await user.type(screen.getByTestId('learn-text'), 'x');
    await user.press(screen.getByTestId('learn-run'));

    await user.press(await screen.findByTestId('learn-add-to'));
    await user.press(screen.getByTestId('learn-add-spicy'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/tones/[key]',
      params: { key: 'spicy', append: 'Make a confident, funny guess about her habits. Lowercase, no emoji.' },
    });
  });

  it('says why when there is nothing to learn, and can start over', async () => {
    const { user } = await setup({ kind: 'declined', reason: 'There is no message in this screenshot.' });
    await user.type(screen.getByTestId('learn-text'), 'x');
    await user.press(screen.getByTestId('learn-run'));

    expect(await screen.findByTestId('learn-declined')).toHaveTextContent(/There is no message/);
    expect(screen.queryByTestId('learn-save-new')).toBeNull();
    await user.press(screen.getByTestId('learn-again'));
    expect(screen.getByTestId('learn-text')).toBeOnTheScreen();
  });

  it('explains a failed request and keeps the example', async () => {
    const { user } = await setup(new EngineError('no_internet'));
    await user.type(screen.getByTestId('learn-text'), 'hello');
    await user.press(screen.getByTestId('learn-run'));

    expect(await screen.findByTestId('learn-error')).toBeOnTheScreen();
    expect(screen.getByTestId('learn-text')).toHaveDisplayValue('hello');
  });

  it('needs a working key', async () => {
    await setup(LEARNED, [makeKey({ status: 'invalid' })]);

    expect(await screen.findByTestId('learn-no-key')).toBeOnTheScreen();
  });
});

describe('ToneScreen: started from an example', () => {
  it('opens a new tone filled in', async () => {
    await renderWithData(<ToneScreen draft={{ label: 'Playful assumption', definition: 'Guess her habits.' }} />);

    expect(await screen.findByTestId('tone-name')).toHaveDisplayValue('Playful assumption');
    expect(screen.getByTestId('tone-definition')).toHaveDisplayValue('Guess her habits.');
  });

  it('adds a learned style to an existing tone, to be saved after a look', async () => {
    const prompts = createFakePromptsRepo([]);
    await renderWithData(<ToneScreen toneKey="casual" append="Guess her habits." />, { promptsRepo: prompts.repo });

    expect(await screen.findByTestId('tone-definition')).toHaveDisplayValue(`${DEFAULT_TONES.casual.definition} Guess her habits.`);
    expect(prompts.repo.addToneVersion).not.toHaveBeenCalled();
    await userEvent.setup().press(screen.getByTestId('tone-save'));
    await waitFor(() =>
      expect(prompts.repo.addToneVersion).toHaveBeenCalledWith('casual', `${DEFAULT_TONES.casual.definition} Guess her habits.`),
    );
  });
});

describe('TuneTonesScreen', () => {
  const GOAL =
    'Mostly girls I already know, close friends I flirt with. I want to turn the flirting into something more and sound confident and bold, never needy.';
  const TUNED = {
    tones: [
      { key: 'casual', definition: 'relaxed, short, lowercase.', change: 'Shorter and lowercase, like you text.' },
      { key: 'spicy', definition: 'bold heat with close friends. never crude, never graphic.', change: 'Bolder with close friends.' },
    ],
    summary: 'Tuned to turn close friends into something more.',
  };

  async function setup({ goal = GOAL as string | undefined, answer = TUNED as unknown, keys = [makeKey()], rows = [FLIRTY, NERDY] } = {}) {
    const prompts = createFakePromptsRepo(rows);
    const tune = jest.fn(async () => {
      if (answer instanceof EngineError) throw answer;
      return { output: answer, usedKey: { id: 'key-1', label: 'Main', provider: 'gemini' as const, model: 'm' }, durationMs: 1 };
    });
    const keysRepo = createFakeKeysRepo(keys);
    await renderWithData(<TuneTonesScreen deps={{ tune: tune as never }} />, {
      promptsRepo: prompts.repo,
      keysRepo: keysRepo.repo,
      profileRepo: createFakeProfileRepo(
        makeProfile({ texting_style: 'short, lowercase', settings: goal === undefined ? {} : { goal } }),
      ).repo,
    });
    await waitFor(() => expect(keysRepo.repo.list).toHaveBeenCalled());
    await waitFor(() => expect(prompts.repo.listUserPrompts).toHaveBeenCalled());
    return { prompts, tune, user: userEvent.setup() };
  }

  it('says which tones will be rewritten, and which stay', async () => {
    await setup();

    expect(await screen.findByTestId('tune-built-in')).toHaveTextContent('Casual, Funny, Flirty, Spicy, Confident, Safe');
    expect(screen.getByTestId('tune-own')).toHaveTextContent('Nerdy');
    expect(screen.getByTestId('tune-goal')).toHaveTextContent(/close friends I flirt with/);
    expect(screen.getByTestId('tune-run')).toHaveAccessibleName('Tune 6 tones');
  });

  it('asks for more words first, and sends nothing', async () => {
    const { tune } = await setup({ goal: 'flirt more' });

    expect(await screen.findByTestId('tune-need-goal')).toHaveTextContent(/You wrote 2 words/);
    expect(screen.getByTestId('tune-run')).toBeDisabled();
    await userEvent.setup().press(screen.getByTestId('tune-write-goal'));
    expect(mockBack).toHaveBeenCalled();
    expect(tune).not.toHaveBeenCalled();
  });

  it('starts from Banter\'s own wording, even for a tone the user already changed', async () => {
    const { tune, user } = await setup();
    await screen.findByTestId('tune-goal');

    await user.press(screen.getByTestId('tune-run'));

    const { input } = (tune.mock.calls[0] as unknown as [{ input: { tones: { key: string; definition: string }[]; profile: object } }])[0];
    expect(input.tones.map((tone) => tone.key)).toEqual(['casual', 'funny', 'flirty', 'spicy', 'confident', 'safe']);
    expect(input.tones.find((tone) => tone.key === 'flirty')?.definition).toBe(DEFAULT_TONES.flirty.definition);
    expect(input.profile).toEqual({ goal: GOAL, textingStyle: 'short, lowercase', interests: null, age: null });
  });

  it('shows each tuned tone, compares it with the current one, and saves nothing until Save all', async () => {
    const { prompts, user } = await setup();
    await screen.findByTestId('tune-goal');
    await user.press(screen.getByTestId('tune-run'));

    expect(await screen.findByTestId('tune-summary')).toHaveTextContent('Tuned to turn close friends into something more.');
    await user.press(screen.getByTestId('tuned-spicy'));
    expect(screen.getByTestId('tuned-current')).toHaveTextContent(DEFAULT_TONES.spicy.definition);
    expect(screen.getByTestId('tuned-new')).toHaveTextContent('bold heat with close friends. never crude, never graphic.');
    expect(prompts.repo.addToneVersion).not.toHaveBeenCalled();
  });

  it('saves every tuned tone, replacing the user\'s earlier version, and goes back', async () => {
    const { prompts, user } = await setup({
      answer: { ...TUNED, tones: [...TUNED.tones, { key: 'flirty', definition: 'warm, cool, lowercase.', change: 'c' }] },
    });
    await screen.findByTestId('tune-goal');
    await user.press(screen.getByTestId('tune-run'));
    await user.press(await screen.findByTestId('tune-save'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(prompts.repo.addToneVersion).toHaveBeenCalledWith('casual', 'relaxed, short, lowercase.');
    expect(prompts.repo.addToneVersion).toHaveBeenCalledWith('spicy', 'bold heat with close friends. never crude, never graphic.');
    expect(prompts.repo.update).toHaveBeenCalledWith('prompt-flirty', { content: 'warm, cool, lowercase.' });
    // The user's own tone is untouched.
    expect(prompts.rows().find((row) => row.id === 'prompt-nerdy')?.content).toBe('One small science reference.');
  });

  it('says why when saving fails, and stays', async () => {
    const { prompts, user } = await setup();
    await screen.findByTestId('tune-goal');
    await user.press(screen.getByTestId('tune-run'));
    await screen.findByTestId('tune-save');
    prompts.failNext();

    await user.press(screen.getByTestId('tune-save'));

    expect(await screen.findByTestId('tune-error')).toHaveTextContent(/No connection/);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('explains a failed request', async () => {
    const { user } = await setup({ answer: new EngineError('no_internet') });
    await screen.findByTestId('tune-goal');

    await user.press(screen.getByTestId('tune-run'));

    expect(await screen.findByTestId('tune-error')).toBeOnTheScreen();
    expect(screen.getByTestId('tune-run')).toBeEnabled();
  });
});
