import { LIMITED_REST_MS, keyCandidates } from '@/generate/key-candidates';
import type { ModelRow } from '@/lib/database.types';
import { makeKey, makeModels } from '@/test-utils';

const NOW = new Date('2026-11-25T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const inMinutes = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

/** The test models plus Gemini's best free model, so a Gemini key has two. */
const models: ModelRow[] = [
  ...makeModels(),
  { ...makeModels()[2], model_id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', is_default: false, rank: 30 },
];

const order = (candidates: ReturnType<typeof keyCandidates>) =>
  candidates.map((candidate) => `${candidate.id}:${candidate.model}`);

describe('keyCandidates', () => {
  it('gives an automatic key every model of its provider, best first', () => {
    const keys = [makeKey({ id: 'a', provider: 'gemini', model: null })];

    expect(keyCandidates(keys, models, NOW)).toEqual([
      { id: 'a', label: 'Main', provider: 'gemini', key: 'test-gemini-key-0001', model: 'gemini-4-hydrogen' },
      { id: 'a', label: 'Main', provider: 'gemini', key: 'test-gemini-key-0001', model: 'gemini-3.5-flash-lite' },
    ]);
  });

  it('gives a key with a chosen model only that model', () => {
    const keys = [makeKey({ id: 'a', provider: 'gemini', model: 'gemini-3.5-flash-lite' })];
    expect(order(keyCandidates(keys, models, NOW))).toEqual(['a:gemini-3.5-flash-lite']);
  });

  it('starts with the best model across all keys, whatever their order in the list', () => {
    const keys = [
      makeKey({ id: 'gemini', provider: 'gemini' }),
      makeKey({ id: 'groq', provider: 'groq' }),
      makeKey({ id: 'claude', provider: 'claude', model: 'claude-sonnet-5-5' }),
    ];

    expect(order(keyCandidates(keys, models, NOW))).toEqual([
      'claude:claude-sonnet-5-5',
      'gemini:gemini-4-hydrogen',
      'gemini:gemini-3.5-flash-lite',
      'groq:qwen/qwen3.8-27b',
    ]);
  });

  it('of two keys with the same model, takes the one higher in the list first', () => {
    const keys = [makeKey({ id: 'first', model: 'gemini-4-hydrogen' }), makeKey({ id: 'second', model: 'gemini-4-hydrogen' })];
    expect(order(keyCandidates(keys, models, NOW))).toEqual(['first:gemini-4-hydrogen', 'second:gemini-4-hydrogen']);
  });

  it('leaves a model that hit its limit until its rest is over, and offers it last meanwhile', () => {
    const keys = [
      makeKey({
        id: 'a',
        model_limits: { 'gemini-4-hydrogen': inMinutes(30), 'gemini-3.5-flash-lite': inMinutes(5) },
      }),
      makeKey({ id: 'b', provider: 'groq' }),
    ];

    // Groq answers first now; the resting Gemini models come after, the one back soonest first.
    expect(order(keyCandidates(keys, models, NOW))).toEqual([
      'b:qwen/qwen3.8-27b',
      'a:gemini-3.5-flash-lite',
      'a:gemini-4-hydrogen',
    ]);
  });

  it('goes back to the best model once its rest is over', () => {
    const keys = [makeKey({ id: 'a', model_limits: { 'gemini-4-hydrogen': ago(1000) } })];
    expect(order(keyCandidates(keys, models, NOW))[0]).toBe('a:gemini-4-hydrogen');
  });

  it('never offers rejected or switched-off keys', () => {
    const keys = [
      makeKey({ id: 'a', status: 'invalid' }),
      makeKey({ id: 'b', status: 'disabled' }),
      makeKey({ id: 'c', status: 'active', model: 'gemini-3.5-flash-lite' }),
    ];
    expect(order(keyCandidates(keys, models, NOW))).toEqual(['c:gemini-3.5-flash-lite']);
  });

  it('leaves a key that ran out of credit alone for 15 minutes', () => {
    const keys = [makeKey({ id: 'a', status: 'limited', limited_at: ago(LIMITED_REST_MS - 1000) })];
    expect(keyCandidates(keys, models, NOW)).toEqual([]);
  });

  it('tries a rested key again, after an active key with the same model', () => {
    const keys = [
      makeKey({ id: 'rested', status: 'limited', limited_at: ago(LIMITED_REST_MS + 1000), model: 'gemini-4-hydrogen' }),
      makeKey({ id: 'active', status: 'active', model: 'gemini-4-hydrogen' }),
      makeKey({ id: 'no-time', status: 'limited', limited_at: null, model: 'gemini-4-hydrogen' }),
    ];
    expect(keyCandidates(keys, models, NOW).map((key) => key.id)).toEqual(['active', 'rested', 'no-time']);
  });

  it('offers nothing when the model list is not available', () => {
    expect(keyCandidates([makeKey()], [], NOW)).toEqual([]);
  });
});
