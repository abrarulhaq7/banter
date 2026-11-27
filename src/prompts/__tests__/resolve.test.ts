import { DEFAULT_CORE, DEFAULT_MODES, DEFAULT_TONES } from '@/engine';
import { resolvePrompts, toneDefinitionProblem, toneFor, toneLabelProblem, type RemoteDefaults } from '@/prompts';
import { makeUserPrompt } from '@/test-utils';

const remote = (overrides: Partial<RemoteDefaults> = {}): RemoteDefaults => ({
  core: { version: DEFAULT_CORE.version + 1, rules: 'REMOTE RULES', output_format: 'REMOTE FORMAT' },
  modes: [
    { id: 'story_reply', label: 'Story reply', instruction: 'REMOTE STORY', sort_order: 1 },
    { id: 'opener', label: 'Opener', instruction: 'REMOTE OPENER', sort_order: 2 },
    { id: 'reply', label: 'Reply', instruction: 'REMOTE REPLY', sort_order: 3 },
    { id: 'analyse', label: 'Analyse', instruction: 'REMOTE ANALYSE', sort_order: 4 },
  ],
  tones: [
    { id: 'flirty', label: 'Flirty', definition: 'REMOTE FLIRTY', sort_order: 2 },
    { id: 'casual', label: 'Casual', definition: 'REMOTE CASUAL', sort_order: 1 },
  ],
  ...overrides,
});

describe('resolvePrompts: where the defaults come from', () => {
  it('uses the copy built into the app when nothing has loaded', () => {
    const resolved = resolvePrompts(null, []);

    expect(resolved.defaultsFrom).toBe('app');
    expect(resolved.core).toBe(DEFAULT_CORE);
    expect(resolved.modes.opener.instruction).toBe(DEFAULT_MODES.opener.instruction);
    expect(resolved.tones.map((tone) => tone.key)).toEqual([
      'casual',
      'funny',
      'flirty',
      'spicy',
      'confident',
      'safe',
      'teasing',
      'mysterious',
      'sincere',
    ]);
    expect(resolved.tones.every((tone) => tone.kind === 'default')).toBe(true);
  });

  it('uses Supabase when its rules are at least as new as the app\'s', () => {
    const resolved = resolvePrompts(remote(), []);

    expect(resolved.defaultsFrom).toBe('supabase');
    expect(resolved.core).toEqual({ version: DEFAULT_CORE.version + 1, rules: 'REMOTE RULES', outputFormat: 'REMOTE FORMAT' });
    expect(resolved.modes.reply.instruction).toBe('REMOTE REPLY');
    // In Supabase's order, and only the tones Supabase lists as active.
    expect(resolved.tones.map((tone) => [tone.key, tone.definition])).toEqual([
      ['casual', 'REMOTE CASUAL'],
      ['flirty', 'REMOTE FLIRTY'],
    ]);
  });

  it('picks up a changed default at the same version, with no new build', () => {
    const same = remote({ core: { version: DEFAULT_CORE.version, rules: 'R', output_format: 'F' } });

    expect(resolvePrompts(same, []).tones[0].definition).toBe('REMOTE CASUAL');
  });

  it('does not go back to older rules because the database was not updated', () => {
    const old = remote({ core: { version: DEFAULT_CORE.version - 1, rules: 'OLD', output_format: 'OLD' } });
    const resolved = resolvePrompts(old, []);

    expect(resolved.defaultsFrom).toBe('app');
    expect(resolved.core).toBe(DEFAULT_CORE);
    expect(resolved.tones.find((tone) => tone.key === 'casual')?.definition).toBe(DEFAULT_TONES.casual.definition);
  });

  it.each([
    ['no active rules', remote({ core: null })],
    ['empty rules', remote({ core: { version: 99, rules: ' ', output_format: 'F' } })],
    ['no tones', remote({ tones: [] })],
    ['a mode missing', remote({ modes: remote().modes.slice(0, 3) })],
  ])('falls back to the app\'s copy when Supabase is incomplete: %s', (_name, incomplete) => {
    expect(resolvePrompts(incomplete, []).defaultsFrom).toBe('app');
  });
});

describe('resolvePrompts: the user\'s own tones', () => {
  it('puts the user\'s version over Banter\'s, and keeps Banter\'s to go back to', () => {
    const own = makeUserPrompt({ id: 'p1', tone_id: 'flirty', content: 'Mine.' });
    const flirty = resolvePrompts(null, [own]).tones.find((tone) => tone.key === 'flirty');

    expect(flirty).toEqual({
      key: 'flirty',
      label: 'Flirty',
      definition: 'Mine.',
      kind: 'edited',
      toneId: 'flirty',
      userPromptId: 'p1',
      defaultDefinition: DEFAULT_TONES.flirty.definition,
    });
  });

  it('lists tones the user made after Banter\'s, oldest first', () => {
    const later = makeUserPrompt({ id: 'p2', label: 'Nerdy', created_at: '2026-11-26T10:00:00Z' });
    const earlier = makeUserPrompt({ id: 'p1', label: 'Dry', created_at: '2026-11-26T09:00:00Z' });
    const tones = resolvePrompts(null, [later, earlier]).tones;

    expect(tones.slice(-2).map((tone) => [tone.key, tone.label, tone.kind, tone.toneId])).toEqual([
      ['p1', 'Dry', 'custom', null],
      ['p2', 'Nerdy', 'custom', null],
    ]);
  });

  it('ignores a personal version of a mode, which the app does not offer', () => {
    const mode = makeUserPrompt({ id: 'p3', mode_id: 'opener', content: 'x' });

    expect(resolvePrompts(null, [mode]).tones).toHaveLength(9);
  });

  it('falls back to the first tone when the chosen one is gone', () => {
    const tones = resolvePrompts(null, []).tones;

    expect(toneFor(tones, 'flirty').key).toBe('flirty');
    expect(toneFor(tones, 'deleted-tone').key).toBe('casual');
    expect(toneFor(tones, null).key).toBe('casual');
  });
});

describe('tone names and definitions', () => {
  const tones = resolvePrompts(null, [makeUserPrompt({ id: 'p1', label: 'Dry' })]).tones;

  it('needs a name that is not taken, whatever the capitals', () => {
    expect(toneLabelProblem('  ', tones)).toBe('Give the tone a name.');
    expect(toneLabelProblem('flirty', tones)).toBe('You already have a tone with this name.');
    expect(toneLabelProblem('DRY', tones)).toBe('You already have a tone with this name.');
    expect(toneLabelProblem('Nerdy', tones)).toBeNull();
    // Renaming a tone to its own name is fine.
    expect(toneLabelProblem('Dry', tones, 'p1')).toBeNull();
    expect(toneLabelProblem('x'.repeat(31), tones)).toMatch(/under 30/);
  });

  it('needs a definition of a sensible length', () => {
    expect(toneDefinitionProblem(' ')).toBe('Describe how lines in this tone should sound.');
    expect(toneDefinitionProblem('Short and dry.')).toBeNull();
    expect(toneDefinitionProblem('x'.repeat(601))).toMatch(/under 600/);
  });
});
