import { parseSupabaseConfig } from '@/lib/env';

const URL = 'https://abcdefghijklmnop.supabase.co';
const KEY = 'sb_publishable_example';

/** Builds an old-style Supabase key (a JWT) with the given role. Not a real key. */
function legacyKey(role: string): string {
  const part = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${part({ alg: 'HS256' })}.${part({ role })}.signature`;
}

describe('parseSupabaseConfig', () => {
  it('accepts a project address and a publishable key', () => {
    expect(parseSupabaseConfig(URL, KEY)).toEqual({
      ok: true,
      config: { url: URL, publishableKey: KEY },
    });
  });

  it('trims spaces and a trailing slash', () => {
    expect(parseSupabaseConfig(` ${URL}/ `, ` ${KEY} `)).toEqual({
      ok: true,
      config: { url: URL, publishableKey: KEY },
    });
  });

  it('accepts an old-style anon key', () => {
    expect(parseSupabaseConfig(URL, legacyKey('anon')).ok).toBe(true);
  });

  it.each([
    [undefined, undefined],
    [URL, undefined],
    [undefined, KEY],
    ['', '  '],
  ])('reports missing settings (%p, %p)', (url, key) => {
    const result = parseSupabaseConfig(url, key);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.problem).toContain('.env.local');
  });

  it('rejects an address that is not a web address', () => {
    const result = parseSupabaseConfig('abcdefghijklmnop', KEY);
    expect(result.ok === false && result.problem).toContain('not a valid address');
  });

  it('refuses a new-style secret key', () => {
    const result = parseSupabaseConfig(URL, 'sb_secret_example');
    expect(result.ok === false && result.problem).toContain('secret key');
  });

  it('refuses an old-style service_role key', () => {
    const result = parseSupabaseConfig(URL, legacyKey('service_role'));
    expect(result.ok === false && result.problem).toContain('secret key');
  });
});
