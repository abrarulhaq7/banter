import type { ModelOutput } from '@/engine';
import {
  adjustableLines,
  initialSession,
  sessionReducer,
  setLabel,
  type ResultSet,
  type SessionAction,
  type SessionState,
} from '@/generate/session';

const screenshot = (name: string) => ({
  previewUri: `file:///${name}.jpg`,
  image: { base64: name, mediaType: 'image/jpeg' as const },
  width: 589,
  height: 1280,
});

const linesOutput: ModelOutput = {
  kind: 'lines',
  username: 'some.one',
  screenType: 'story',
  noticed: 'ramen',
  sentLineStatus: 'unknown',
  lines: [
    { text: 'One', hook: 'a' },
    { text: 'Two', hook: 'b' },
  ],
};

const set = (id: string, overrides: Partial<ResultSet> = {}): ResultSet => ({
  id,
  lineIds: [`${id}-line-1`, `${id}-line-2`],
  mode: 'story_reply',
  modeLabel: 'Story reply',
  toneLabel: 'Casual',
  adjustment: null,
  output: linesOutput,
  usedKey: { id: 'k', label: 'Main', provider: 'gemini', model: 'm' },
  durationMs: 2000,
  ...overrides,
});

const play = (actions: SessionAction[], from: SessionState = initialSession) =>
  actions.reduce(sessionReducer, from);

describe('sessionReducer', () => {
  it('starts with no screenshot, Story reply and Casual', () => {
    expect(initialSession).toMatchObject({ screenshot: null, mode: 'story_reply', tone: 'casual', context: null });
  });

  it('adds each new set above the earlier ones and never replaces them', () => {
    const state = play([
      { type: 'screenshotReady', screenshot: screenshot('a') },
      { type: 'generateStarted' },
      { type: 'generateSucceeded', set: set('set-1') },
      { type: 'setTone', tone: 'flirty' },
      { type: 'generateStarted' },
      { type: 'generateSucceeded', set: set('set-2', { toneLabel: 'Flirty' }) },
    ]);

    expect(state.sets.map((item) => item.id)).toEqual(['set-2', 'set-1']);
    expect(state.phase).toBe('idle');
  });

  it('keeps a line through any number of later generations', () => {
    const kept = { id: 'set-1:0', text: 'One', label: 'Casual · Story reply' };
    const state = play([
      { type: 'screenshotReady', screenshot: screenshot('a') },
      { type: 'generateSucceeded', set: set('set-1') },
      { type: 'toggleKeep', line: kept },
      { type: 'generateSucceeded', set: set('set-2') },
      { type: 'generateSucceeded', set: set('set-3') },
    ]);

    expect(state.kept).toEqual([kept]);
  });

  it('removes a kept line when Keep is tapped again, and cannot keep the same line twice', () => {
    const kept = { id: 'set-1:0', text: 'One', label: 'x' };
    const once = play([{ type: 'toggleKeep', line: kept }]);
    expect(once.kept).toHaveLength(1);
    expect(play([{ type: 'toggleKeep', line: kept }], once).kept).toEqual([]);
  });

  it('leaves earlier sets and kept lines alone when a generation fails', () => {
    const kept = { id: 'set-1:0', text: 'One', label: 'x' };
    const state = play([
      { type: 'screenshotReady', screenshot: screenshot('a') },
      { type: 'generateSucceeded', set: set('set-1') },
      { type: 'toggleKeep', line: kept },
      { type: 'generateStarted' },
      { type: 'generateFailed', error: { kind: 'no_internet', message: 'No connection.' } },
    ]);

    expect(state.sets).toHaveLength(1);
    expect(state.kept).toEqual([kept]);
    expect(state.error).toEqual({ kind: 'no_internet', message: 'No connection.' });
    expect(state.phase).toBe('idle');
  });

  it('clears the error when the next generation starts', () => {
    const state = play([
      { type: 'generateFailed', error: { kind: 'limit', message: 'x' } },
      { type: 'generateStarted' },
    ]);
    expect(state.error).toBeNull();
  });

  it('starts over when a new screenshot is chosen', () => {
    const state = play([
      { type: 'screenshotReady', screenshot: screenshot('a') },
      { type: 'generateSucceeded', set: set('set-1') },
      { type: 'toggleKeep', line: { id: 'set-1:0', text: 'One', label: 'x' } },
      { type: 'copied', lineId: 'set-1:0' },
      { type: 'screenshotLoading' },
      { type: 'screenshotReady', screenshot: screenshot('b') },
    ]);

    expect(state.screenshot?.image.base64).toBe('b');
    expect(state.sets).toEqual([]);
    expect(state.kept).toEqual([]);
    expect(state.copiedLineId).toBeNull();
  });

  it('keeps the current screenshot and lines when choosing another one fails or is cancelled', () => {
    const before = play([
      { type: 'screenshotReady', screenshot: screenshot('a') },
      { type: 'generateSucceeded', set: set('set-1') },
    ]);

    const failed = play([{ type: 'screenshotLoading' }, { type: 'screenshotFailed', message: 'No photos found.' }], before);
    expect(failed.screenshot?.image.base64).toBe('a');
    expect(failed.sets).toHaveLength(1);
    expect(failed.error).toEqual({ kind: 'screenshot', message: 'No photos found.' });

    const cancelled = play([{ type: 'screenshotLoading' }, { type: 'screenshotFailed', message: null }], before);
    expect(cancelled.error).toBeNull();
    expect(cancelled.phase).toBe('idle');
  });

  it('selects a context, and clears it when it is tapped again', () => {
    const chosen = play([{ type: 'setContext', context: 'stranger' }]);
    expect(chosen.context).toBe('stranger');
    expect(play([{ type: 'setContext', context: 'know_her' }], chosen).context).toBe('know_her');
    expect(play([{ type: 'setContext', context: 'stranger' }], chosen).context).toBeNull();
  });

  it('remembers which line was copied last', () => {
    expect(play([{ type: 'copied', lineId: 'set-1:1' }]).copiedLineId).toBe('set-1:1');
  });
});

describe('sessionReducer: who the screenshot is of', () => {
  it('takes the username from the first answer that reads one, and keeps it', () => {
    const other: ModelOutput = { ...linesOutput, username: 'someone.else' };
    const state = play([
      { type: 'screenshotReady', screenshot: screenshot('a') },
      { type: 'generateSucceeded', set: set('set-1') },
      { type: 'generateSucceeded', set: set('set-2', { output: other }) },
    ]);
    expect(state.username).toBe('some.one');
  });

  it('stays unknown when the answer has no username', () => {
    const unread: ModelOutput = { ...linesOutput, username: null };
    expect(play([{ type: 'generateSucceeded', set: set('set-1', { output: unread }) }]).username).toBeNull();
  });

  it('lets the user correct it, and the correction sticks', () => {
    const state = play([
      { type: 'generateSucceeded', set: set('set-1') },
      { type: 'setUsername', username: 'the.right.one' },
      { type: 'generateSucceeded', set: set('set-2') },
    ]);
    expect(state.username).toBe('the.right.one');
  });

  it('fills in the remembered context only when none is chosen', () => {
    expect(play([{ type: 'rememberContext', context: 'know_her' }]).context).toBe('know_her');
    const chosen = play([{ type: 'setContext', context: 'stranger' }]);
    expect(play([{ type: 'rememberContext', context: 'know_her' }], chosen).context).toBe('stranger');
  });

  it('forgets the person and the context when a new screenshot is chosen', () => {
    const state = play([
      { type: 'generateSucceeded', set: set('set-1') },
      { type: 'setContext', context: 'stranger' },
      { type: 'screenshotReady', screenshot: screenshot('b') },
    ]);
    expect(state.username).toBeNull();
    expect(state.context).toBeNull();
  });
});

describe('adjustableLines', () => {
  it('gives the lines of a lines set', () => {
    expect(adjustableLines(set('s'))).toEqual(['One', 'Two']);
  });

  it('gives nothing for an analysis, a decline or no set', () => {
    const declined: ModelOutput = { kind: 'declined', username: null, screenType: 'other', noticed: '', sentLineStatus: 'unknown', reason: 'x' };
    expect(adjustableLines(set('s', { output: declined }))).toBeNull();
    expect(adjustableLines(undefined)).toBeNull();
  });
});

describe('setLabel', () => {
  it('names the tone and the mode, or just the mode for Analyse', () => {
    expect(setLabel({ toneLabel: 'Flirty', modeLabel: 'Story reply' })).toBe('Flirty · Story reply');
    expect(setLabel({ toneLabel: null, modeLabel: 'Analyse' })).toBe('Analyse');
  });
});
