import { createSecureSessionStorage, type SessionStorage } from '@/lib/secure-session-storage';

/**
 * A copy of one user's data kept in the phone's secure storage, so the app can show it
 * at once on start and still works without internet. Supabase stays the source of truth.
 */
export type UserCache<T> = {
  read: () => Promise<T | null>;
  write: (value: T) => Promise<void>;
  clear: () => Promise<void>;
};

export type CacheName = 'keys' | 'profile';

export function createUserCache<T>(
  name: CacheName,
  userId: string,
  storage: SessionStorage = createSecureSessionStorage(),
): UserCache<T> {
  const key = `banter.${name}.${userId}`;
  return {
    async read() {
      try {
        const raw = await storage.getItem(key);
        return raw === null ? null : (JSON.parse(raw) as T);
      } catch {
        // A cache that cannot be read is treated as empty; the server copy is fetched next.
        return null;
      }
    },
    async write(value) {
      try {
        await storage.setItem(key, JSON.stringify(value));
      } catch {
        // The cache is a convenience. Failing to write it must not fail the save itself.
      }
    },
    async clear() {
      try {
        await storage.removeItem(key);
      } catch {
        // Nothing useful to do.
      }
    },
  };
}

/** Removes everything cached for a user. Called on sign-out. */
export async function clearUserCaches(userId: string, storage?: SessionStorage): Promise<void> {
  await Promise.all([
    createUserCache('keys', userId, storage).clear(),
    createUserCache('profile', userId, storage).clear(),
  ]);
}
