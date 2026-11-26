import * as SecureStore from 'expo-secure-store';

/**
 * Keeps the sign-in session in the phone's secure storage (iOS Keychain, Android Keystore).
 *
 * A session is larger than the 2048 bytes that secure storage is guaranteed to hold per
 * value, so it is saved in pieces: `<key>.n` holds the number of pieces and
 * `<key>.0`, `<key>.1`, ... hold the pieces.
 */

/** The part of expo-secure-store this needs. Tests pass a fake. */
export type SecureBackend = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

/** The storage interface supabase-js expects. */
export type SessionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/** Pieces are plain ASCII (see `setItem`), so this is also the size in bytes. */
const PIECE_SIZE = 1800;

// Readable after the first unlock since boot, so a background token refresh still works.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const deviceSecureStore: SecureBackend = {
  getItemAsync: (key) => SecureStore.getItemAsync(key, OPTIONS),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};

export function createSecureSessionStorage(
  backend: SecureBackend = deviceSecureStore,
): SessionStorage {
  const countKey = (key: string) => `${key}.n`;
  const pieceKey = (key: string, index: number) => `${key}.${index}`;

  async function readCount(key: string): Promise<number> {
    const raw = await backend.getItemAsync(countKey(key));
    const count = raw === null ? 0 : Number(raw);
    return Number.isInteger(count) && count > 0 ? count : 0;
  }

  async function deletePieces(key: string, from: number, to: number) {
    for (let index = from; index < to; index += 1) {
      await backend.deleteItemAsync(pieceKey(key, index));
    }
  }

  return {
    async getItem(key) {
      const count = await readCount(key);
      if (count === 0) return null;

      const pieces = await Promise.all(
        Array.from({ length: count }, (_, index) => backend.getItemAsync(pieceKey(key, index))),
      );
      // A missing piece means an interrupted write. Treat it as "no session": the user
      // signs in again, which is safer than handing back half a session.
      if (pieces.some((piece) => piece === null)) return null;

      try {
        return decodeURIComponent(pieces.join(''));
      } catch {
        return null;
      }
    },

    async setItem(key, value) {
      // Encoding first makes the text pure ASCII, so cutting it into pieces can never
      // split a character, and every piece has a known size in bytes.
      const encoded = encodeURIComponent(value);
      const pieces: string[] = [];
      for (let start = 0; start < encoded.length; start += PIECE_SIZE) {
        pieces.push(encoded.slice(start, start + PIECE_SIZE));
      }

      const previousCount = await readCount(key);
      for (let index = 0; index < pieces.length; index += 1) {
        await backend.setItemAsync(pieceKey(key, index), pieces[index]);
      }
      await backend.setItemAsync(countKey(key), String(pieces.length));
      await deletePieces(key, pieces.length, previousCount);
    },

    async removeItem(key) {
      const count = await readCount(key);
      await backend.deleteItemAsync(countKey(key));
      await deletePieces(key, 0, count);
    },
  };
}
