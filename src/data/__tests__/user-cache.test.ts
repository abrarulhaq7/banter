import { clearUserCaches, createUserCache } from '@/data';
import { createSecureSessionStorage, type SecureBackend } from '@/lib/secure-session-storage';

function memoryStorage() {
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
  return { items, storage: createSecureSessionStorage(backend) };
}

describe('user cache', () => {
  it('gives back what was saved, including a long list', async () => {
    const { storage } = memoryStorage();
    const cache = createUserCache<{ keys: string[] }>('keys', 'user-a', storage);
    const value = { keys: Array.from({ length: 50 }, (_, index) => `key-${index}-${'x'.repeat(80)}`) };

    await cache.write(value);

    expect(await cache.read()).toEqual(value);
  });

  it('is empty before anything is saved', async () => {
    expect(await createUserCache('keys', 'user-a', memoryStorage().storage).read()).toBeNull();
  });

  it('keeps each user\'s data apart', async () => {
    const { storage } = memoryStorage();
    await createUserCache('keys', 'user-a', storage).write({ owner: 'a' });

    expect(await createUserCache('keys', 'user-b', storage).read()).toBeNull();
    expect(await createUserCache('profile', 'user-a', storage).read()).toBeNull();
  });

  it('treats unreadable saved data as empty instead of crashing', async () => {
    const { items, storage } = memoryStorage();
    const cache = createUserCache('keys', 'user-a', storage);
    await cache.write({ ok: true });
    items.set('banter.keys.user-a.0', encodeURIComponent('{not json'));

    expect(await cache.read()).toBeNull();
  });

  it('removes a user\'s keys and profile on sign-out, and nobody else\'s', async () => {
    const { items, storage } = memoryStorage();
    await createUserCache('keys', 'user-a', storage).write({ k: 1 });
    await createUserCache('profile', 'user-a', storage).write({ p: 1 });
    await createUserCache('keys', 'user-b', storage).write({ k: 2 });

    await clearUserCaches('user-a', storage);

    expect([...items.keys()].filter((key) => key.includes('user-a'))).toEqual([]);
    expect(await createUserCache('keys', 'user-b', storage).read()).toEqual({ k: 2 });
  });

  it('never lets a storage failure break a save', async () => {
    const broken = {
      getItem: async () => {
        throw new Error('keychain locked');
      },
      setItem: async () => {
        throw new Error('keychain locked');
      },
      removeItem: async () => {
        throw new Error('keychain locked');
      },
    };
    const cache = createUserCache('keys', 'user-a', broken);

    await expect(cache.write({ k: 1 })).resolves.toBeUndefined();
    await expect(cache.read()).resolves.toBeNull();
    await expect(cache.clear()).resolves.toBeUndefined();
  });
});
