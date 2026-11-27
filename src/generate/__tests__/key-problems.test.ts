import type { KeyPatch } from '@/data';
import type { KeyProblem } from '@/engine';
import { DAILY_LIMIT_REST_MS, LIMIT_REST_MS, keyProblemSaver, limitRestMs, stillResting } from '@/generate/key-problems';
import { makeKey } from '@/test-utils';

const NOW = new Date('2026-11-26T12:00:00Z');
const later = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe('limitRestMs', () => {
  it('rests a model at a daily limit for an hour, then tries it again', () => {
    expect(limitRestMs({ daily: true })).toBe(DAILY_LIMIT_REST_MS);
    expect(limitRestMs({ daily: true, retryAfterMs: 20_000 })).toBe(DAILY_LIMIT_REST_MS);
  });

  it('rests a model at a daily limit until the provider says it resets, at most a day', () => {
    // Gemini on 2026-11-27: "limit: 20 requests per day on Free Tier. Please retry in 22h38m10s".
    const reset = (22 * 60 + 38) * 60_000 + 10_000;
    expect(limitRestMs({ daily: true, retryAfterMs: reset })).toBe(reset);
    expect(limitRestMs({ daily: true, retryAfterMs: 3 * 24 * 60 * 60_000 })).toBe(24 * 60 * 60_000);
  });

  it('waits as long as the provider says, within reason', () => {
    expect(limitRestMs({ retryAfterMs: 37_500 })).toBe(37_500);
    expect(limitRestMs({ retryAfterMs: 0 })).toBe(5_000);
    expect(limitRestMs({ retryAfterMs: 10 * DAILY_LIMIT_REST_MS })).toBe(DAILY_LIMIT_REST_MS);
  });

  it('rests five minutes when the provider says nothing', () => {
    expect(limitRestMs(undefined)).toBe(LIMIT_REST_MS);
    expect(limitRestMs({})).toBe(LIMIT_REST_MS);
  });
});

describe('stillResting', () => {
  it('drops the rests that are over', () => {
    expect(
      stillResting({ over: '2026-11-26T11:00:00Z', resting: '2026-11-26T13:00:00Z' }, NOW.getTime()),
    ).toEqual({ resting: '2026-11-26T13:00:00Z' });
    expect(stillResting(undefined, NOW.getTime())).toEqual({});
  });
});

describe('keyProblemSaver', () => {
  const setup = (keys = [makeKey({ id: 'a' })]) => {
    const patches: [string, KeyPatch][] = [];
    const updateKey = jest.fn(async (id: string, patch: KeyPatch) => {
      patches.push([id, patch]);
      return { ok: true as const };
    });
    return { save: keyProblemSaver(keys, updateKey, () => NOW), patches };
  };
  const problem = (overrides: Partial<KeyProblem>): KeyProblem => ({
    keyId: 'a',
    model: 'gemini-4-hydrogen',
    scope: 'model',
    status: 'limited',
    message: 'This key has reached its limit.',
    ...overrides,
  });

  it('rests only the model that hit its limit; the key stays as it was', async () => {
    const { save, patches } = setup();
    await save(problem({ limit: { retryAfterMs: 40_000 } }));

    expect(patches).toEqual([['a', { model_limits: { 'gemini-4-hydrogen': later(40_000) } }]]);
  });

  it('keeps every model that hit its limit in the same request, and the rests saved before', async () => {
    const { save, patches } = setup([
      makeKey({ id: 'a', model_limits: { older: later(60_000), over: '2026-11-26T11:00:00Z' } }),
    ]);
    await save(problem({ model: 'gemini-4-hydrogen', limit: { daily: true } }));
    await save(problem({ model: 'gemini-3.8-flash' }));

    expect(patches[1]).toEqual([
      'a',
      {
        model_limits: {
          older: later(60_000),
          'gemini-4-hydrogen': later(DAILY_LIMIT_REST_MS),
          'gemini-3.8-flash': later(LIMIT_REST_MS),
        },
      },
    ]);
  });

  it('marks the whole key when it has no credit or was rejected', async () => {
    const { save, patches } = setup();
    await save(problem({ scope: 'key', status: 'limited', message: 'No credit.' }));
    await save(problem({ scope: 'key', status: 'invalid', message: 'Rejected.' }));

    expect(patches).toEqual([
      ['a', { status: 'limited', last_error: 'No credit.', limited_at: NOW.toISOString() }],
      ['a', { status: 'invalid', last_error: 'Rejected.', limited_at: null }],
    ]);
  });
});
