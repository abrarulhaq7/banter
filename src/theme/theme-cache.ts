import { createSecureSessionStorage, type SessionStorage } from '@/lib/secure-session-storage';

import { isThemeName, type ThemeName } from './themes';

/**
 * The chosen theme, kept on the phone. It belongs to the phone, not to an account, so the
 * app opens in the right colours before anyone has signed in.
 */
const KEY = 'banter.theme';

export async function readSavedTheme(storage: SessionStorage = createSecureSessionStorage()): Promise<ThemeName | null> {
  try {
    const value = await storage.getItem(KEY);
    return isThemeName(value) ? value : null;
  } catch {
    return null;
  }
}

export async function saveTheme(name: ThemeName, storage: SessionStorage = createSecureSessionStorage()): Promise<void> {
  try {
    await storage.setItem(KEY, name);
  } catch {
    // The theme still applies now; it just will not be remembered on this phone.
  }
}
