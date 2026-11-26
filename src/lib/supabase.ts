import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseConfig } from './env';
import { createSecureSessionStorage } from './secure-session-storage';

let client: SupabaseClient | null | undefined;

/**
 * The app's single Supabase client, or null when the connection settings are missing or
 * wrong (see `getSupabaseConfig()` for the reason).
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const result = getSupabaseConfig();
  if (!result.ok) {
    client = null;
    return client;
  }

  client = createClient(result.config.url, result.config.publishableKey, {
    auth: {
      storage: createSecureSessionStorage(),
      autoRefreshToken: true,
      persistSession: true,
      // A phone app has no page address to read a session from.
      detectSessionInUrl: false,
    },
  });
  return client;
}
