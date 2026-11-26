/**
 * Reads the Supabase connection settings from the build's environment.
 *
 * They come from `.env.local` (not in git):
 *   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
 *
 * Both values are public by design: they ship inside the app, and the database's
 * row-level security is what protects the data. A secret key must never be put here.
 */

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseConfigResult =
  | { ok: true; config: SupabaseConfig }
  | { ok: false; problem: string };

export function parseSupabaseConfig(
  rawUrl: string | undefined,
  rawKey: string | undefined,
): SupabaseConfigResult {
  const url = rawUrl?.trim().replace(/\/+$/, '') ?? '';
  const key = rawKey?.trim() ?? '';

  if (!url || !key) {
    return {
      ok: false,
      problem:
        'Supabase is not connected. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the dev server.',
    };
  }
  if (!/^https?:\/\/[^\s/]+$/.test(url)) {
    return {
      ok: false,
      problem:
        'EXPO_PUBLIC_SUPABASE_URL is not a valid address. It should look like https://xxxx.supabase.co',
    };
  }
  if (isSecretKey(key)) {
    return {
      ok: false,
      problem:
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a secret key. A secret key gives full access to the database and must never be in the app. Use the publishable key (sb_publishable_...).',
    };
  }
  return { ok: true, config: { url, publishableKey: key } };
}

/** True for a new-style secret key, or an old-style key whose role is service_role. */
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;

  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: unknown }).role === 'service_role';
  } catch {
    return false;
  }
}

export function getSupabaseConfig(): SupabaseConfigResult {
  // Expo replaces these at build time only when they are written out in full like this.
  return parseSupabaseConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
