import type { ModelOutput } from '@/engine';
import type { AppInfo } from '@/feedback/app-info';
import { includedItems, setForTicket, ticketContext, type LineMarks } from '@/feedback/ticket';
import type { ResultSet } from '@/generate/session';

const APP: AppInfo = { version: '0.1.0', platform: 'android', os: '10', device: 'Pixel 4', update: null };

const lines: ModelOutput = {
  kind: 'lines',
  username: 'some.one',
  screenType: 'story',
  noticed: 'A bowl of pho.',
  sentLineStatus: 'unknown',
  lines: [
    { text: 'One', hook: 'the broth', move: 'tease' },
    { text: 'Two', hook: 'table 24' },
    { text: 'Three', hook: 'the herbs', move: 'challenge' },
  ],
};

const set = (overrides: Partial<ResultSet> = {}): ResultSet => ({
  id: 'set-1',
  lineIds: ['l1', 'l2', 'l3'],
  mode: 'story_reply',
  modeLabel: 'Story reply',
  toneKey: 'flirty',
  toneLabel: 'Flirty',
  adjustment: null,
  direction: null,
  fix: null,
  output: lines,
  usedKey: { id: 'k', label: 'Main', provider: 'gemini', model: 'gemini-3.6-flash' },
  durationMs: 23456,
  promptVersion: 8,
  request: '## Task\nThe screenshot is her Instagram story.',
  ...overrides,
});

const marks: LineMarks = {
  liked: { l1: true },
  feedback: { l2: 'cringe' },
  copiedLineId: 'l1',
  kept: [{ id: 'l3', text: 'Three', label: 'Flirty · Story reply' }],
};

describe('setForTicket', () => {
  it('says what the set was focused on', () => {
    expect(setForTicket({ ...set(), focus: 'her nails' }, marks, { context: null, username: null })).toMatchObject({
      focus: 'her nails',
    });
  });

  it('attaches the options, the model, each line with what the user did, and the request as sent', () => {
    expect(setForTicket(set(), marks, { context: 'stranger', username: 'some.one' })).toEqual({
      interactionId: 'set-1',
      mode: 'Story reply',
      tone: 'Flirty',
      adjustment: null,
      direction: null,
      focus: null,
      fix: null,
      howYouKnowHer: 'stranger',
      username: 'some.one',
      model: 'gemini / gemini-3.6-flash',
      promptVersion: 8,
      seconds: 23.5,
      screenType: 'story',
      noticed: 'A bowl of pho.',
      read: null,
      lines: [
        { text: 'One', hook: 'the broth', move: 'tease', liked: true, notForMe: null, copied: true, saved: false },
        { text: 'Two', hook: 'table 24', move: null, liked: false, notForMe: 'cringe', copied: false, saved: false },
        {
          text: 'Three',
          hook: 'the herbs',
          move: 'challenge',
          liked: false,
          notForMe: null,
          copied: false,
          saved: true,
        },
      ],
      request: '## Task\nThe screenshot is her Instagram story.',
    });
  });

  it('attaches an analysis, or the reason the AI declined', () => {
    const analysis: ModelOutput = {
      kind: 'analysis',
      username: null,
      screenType: 'chat',
      noticed: 'n',
      sentLineStatus: 'unknown',
      interest: 'low',
      signals: ['one-word replies'],
      advice: 'Leave it.',
      suggestedReply: null,
    };
    expect(
      setForTicket(set({ output: analysis, lineIds: [] }), marks, { context: null, username: null }),
    ).toMatchObject({
      interest: 'low',
      signals: ['one-word replies'],
      advice: 'Leave it.',
      suggestedReply: null,
    });

    const declined: ModelOutput = {
      kind: 'declined',
      username: null,
      screenType: 'other',
      noticed: '',
      sentLineStatus: 'unknown',
      reason: 'Not Instagram.',
    };
    expect(
      setForTicket(set({ output: declined, lineIds: [] }), marks, { context: null, username: null }),
    ).toMatchObject({
      declined: 'Not Instagram.',
    });
  });
});

describe('ticketContext', () => {
  it('says where it was sent from and on what, with the set when there is one', () => {
    expect(ticketContext('settings', APP, null)).toEqual({ where: 'settings', app: APP });
    expect(ticketContext('results', APP, { tone: 'Flirty' })).toEqual({
      where: 'results',
      app: APP,
      set: { tone: 'Flirty' },
    });
  });
});

describe('includedItems', () => {
  it('lists what is attached, in plain words', () => {
    expect(includedItems(APP, set(), true)).toEqual([
      'This set: Flirty · Story reply, 3 lines, with what you did with each',
      'The options you picked, and how you know her',
      'The model that answered (gemini-3.6-flash) and the rules version',
      'What Banter noticed, and the request it sent',
      'The screenshot',
      'Banter 0.1.0 on Android 10',
      'Your email, from your login, so the answer can find you',
    ]);
    expect(includedItems(APP, null, false)).toEqual([
      'Banter 0.1.0 on Android 10',
      'Your email, from your login, so the answer can find you',
    ]);
  });

  it('counts the pictures the user added', () => {
    expect(includedItems(APP, null, false, 1)).toContain('Your picture');
    expect(includedItems(APP, null, false, 3)).toContain('Your 3 pictures');
  });

  it('names the update sent over the air when the app runs one', () => {
    const update = {
      id: 'update-1',
      createdAt: new Date(2026, 10, 27, 14, 5).toISOString(),
      channel: 'preview',
      runtimeVersion: 'fingerprint-1',
    };
    expect(includedItems({ ...APP, update }, null, false)).toEqual([
      'Banter 0.1.0 on Android 10',
      'The app update it runs, from 27 Nov, 14:05',
      'Your email, from your login, so the answer can find you',
    ]);
  });
});
