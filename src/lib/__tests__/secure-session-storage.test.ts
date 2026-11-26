import { createSecureSessionStorage, type SecureBackend } from '@/lib/secure-session-storage';

const KEY = 'sb-abcdefghijklmnop-auth-token';
/** Secure storage is only guaranteed to hold values up to this many bytes. */
const SECURE_STORE_LIMIT = 2048;

function createFakeBackend() {
  const items = new Map<string, string>();
  const backend: SecureBackend = {
    getItemAsync: async (key) => items.get(key) ?? null,
    setItemAsync: async (key, value) => {
      items.set(key, value);
    },
    deleteItemAsync: async (key) => {
      items.delete(key);
    },
  };
  return { items, backend };
}

/** About the size and shape of a real session: long tokens plus user details. */
function sessionOfLength(length: number): string {
  return JSON.stringify({ access_token: 'x'.repeat(length), user: { email: 'sam@example.com' } });
}

describe('secure session storage', () => {
  it('returns null when nothing is saved', async () => {
    const storage = createSecureSessionStorage(createFakeBackend().backend);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('gives back exactly what was saved', async () => {
    const storage = createSecureSessionStorage(createFakeBackend().backend);
    const session = sessionOfLength(6000);

    await storage.setItem(KEY, session);

    expect(await storage.getItem(KEY)).toBe(session);
  });

  it('keeps every stored piece within the secure storage size limit', async () => {
    const { items, backend } = createFakeBackend();
    const storage = createSecureSessionStorage(backend);

    await storage.setItem(KEY, sessionOfLength(9000));

    expect(items.size).toBeGreaterThan(2);
    for (const value of items.values()) {
      expect(new TextEncoder().encode(value).length).toBeLessThanOrEqual(SECURE_STORE_LIMIT);
    }
  });

  it('survives emoji and non-English text, which take several bytes per character', async () => {
    const { items, backend } = createFakeBackend();
    const storage = createSecureSessionStorage(backend);
    const session = JSON.stringify({ name: 'عمر 😀'.repeat(700) });

    await storage.setItem(KEY, session);

    expect(await storage.getItem(KEY)).toBe(session);
    for (const value of items.values()) {
      expect(new TextEncoder().encode(value).length).toBeLessThanOrEqual(SECURE_STORE_LIMIT);
    }
  });

  it('leaves no old pieces behind when a shorter session replaces a longer one', async () => {
    const { items, backend } = createFakeBackend();
    const storage = createSecureSessionStorage(backend);

    await storage.setItem(KEY, sessionOfLength(9000));
    const short = sessionOfLength(100);
    await storage.setItem(KEY, short);

    expect(await storage.getItem(KEY)).toBe(short);
    expect([...items.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.n`]);
  });

  it('removes everything on sign-out', async () => {
    const { items, backend } = createFakeBackend();
    const storage = createSecureSessionStorage(backend);
    await storage.setItem(KEY, sessionOfLength(6000));

    await storage.removeItem(KEY);

    expect(items.size).toBe(0);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('treats a half-written session as no session', async () => {
    const { items, backend } = createFakeBackend();
    const storage = createSecureSessionStorage(backend);
    await storage.setItem(KEY, sessionOfLength(6000));

    items.delete(`${KEY}.1`);

    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('keeps different keys apart', async () => {
    const storage = createSecureSessionStorage(createFakeBackend().backend);

    await storage.setItem(KEY, 'first');
    await storage.setItem(`${KEY}-code-verifier`, 'second');
    await storage.removeItem(`${KEY}-code-verifier`);

    expect(await storage.getItem(KEY)).toBe('first');
  });
});
