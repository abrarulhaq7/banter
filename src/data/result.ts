/** What every save or delete reports back to a screen. */
export type Result = { ok: true } | { ok: false; message: string };

const NO_CONNECTION = 'No connection. Check your internet and try again.';

/** Turns a failed Supabase request into one plain sentence. Never shows raw server text. */
export function dataErrorMessage(error: unknown, action: string): string {
  const info = (error ?? {}) as { message?: unknown; code?: unknown; status?: unknown };
  const message = typeof info.message === 'string' ? info.message : '';

  if (/network request failed|failed to fetch|fetch failed|timeout/i.test(message)) return NO_CONNECTION;
  // 23505: the database's code for "this already exists".
  if (info.code === '23505') return 'That already exists.';
  // 23514: a value the database does not accept.
  if (info.code === '23514') return 'One of the values was not accepted. Check them and try again.';
  if (info.code === 'PGRST301' || info.status === 401) return 'Your session has ended. Sign in again.';
  return `Could not ${action}. Try again.`;
}

export function failure(error: unknown, action: string): Result {
  return { ok: false, message: dataErrorMessage(error, action) };
}
