import { LIMITED_REST_MS, keyCandidates } from '@/generate/key-candidates';
import { makeKey, makeModels } from '@/test-utils';

const NOW = new Date('2026-11-25T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('keyCandidates', () => {
  const models = makeModels();

  it('offers active keys in the user\'s order, each with the model it will use', () => {
    const keys = [
      makeKey({ id: 'a', provider: 'gemini', model: null }),
      makeKey({ id: 'b', provider: 'claude', model: 'claude-sonnet-5-5', key: 'k-b', label: 'Work' }),
    ];

    expect(keyCandidates(keys, models, NOW)).toEqual([
      { id: 'a', label: 'Main', provider: 'gemini', key: 'test-gemini-key-0001', model: 'gemini-3.5-flash-lite' },
      { id: 'b', label: 'Work', provider: 'claude', key: 'k-b', model: 'claude-sonnet-5-5' },
    ]);
  });

  it('never offers rejected or switched-off keys', () => {
    const keys = [
      makeKey({ id: 'a', status: 'invalid' }),
      makeKey({ id: 'b', status: 'disabled' }),
      makeKey({ id: 'c', status: 'active' }),
    ];
    expect(keyCandidates(keys, models, NOW).map((key) => key.id)).toEqual(['c']);
  });

  it('leaves a key alone for 15 minutes after it hit its limit', () => {
    const keys = [makeKey({ id: 'a', status: 'limited', limited_at: ago(LIMITED_REST_MS - 1000) })];
    expect(keyCandidates(keys, models, NOW)).toEqual([]);
  });

  it('tries a rested key again, after the active ones', () => {
    const keys = [
      makeKey({ id: 'rested', status: 'limited', limited_at: ago(LIMITED_REST_MS + 1000) }),
      makeKey({ id: 'active', status: 'active' }),
      makeKey({ id: 'no-time', status: 'limited', limited_at: null }),
    ];
    expect(keyCandidates(keys, models, NOW).map((key) => key.id)).toEqual(['active', 'rested', 'no-time']);
  });

  it('offers nothing when the model list is not available', () => {
    expect(keyCandidates([makeKey()], [], NOW)).toEqual([]);
  });
});
