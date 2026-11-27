import { guessProvider, maskKey } from '@/providers/providers';

describe('guessProvider', () => {
  it.each([
    ['sk-ant-api03-abc', 'claude'],
    ['sk-proj-abc', 'openai'],
    ['  sk-abc', 'openai'],
    ['AIzaSyAbc', 'gemini'],
    ['sk-or-v1-abc', 'openrouter'],
    ['gsk_abc', 'groq'],
  ])('%s looks like %s', (key, provider) => {
    expect(guessProvider(key)).toBe(provider);
  });

  it('does not guess when the key has no known start', () => {
    expect(guessProvider('')).toBeNull();
    expect(guessProvider('some-other-key')).toBeNull();
  });
});

describe('maskKey', () => {
  it('shows only the last four characters', () => {
    expect(maskKey('sk-ant-api03-abcdefghijWXYZ')).toBe('••••••••WXYZ');
  });

  it('shows nothing of a very short key', () => {
    expect(maskKey('abcd1234')).toBe('••••••••');
  });
});
