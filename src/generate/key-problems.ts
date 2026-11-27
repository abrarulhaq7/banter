import type { KeyPatch, Result } from '@/data';
import type { KeyProblem, LimitHint } from '@/engine';
import type { ApiKeyRow, ModelLimits } from '@/lib/database.types';

/**
 * A model at a daily limit, when the provider does not say when it resets, is tried again
 * every hour: providers reset at different times.
 */
export const DAILY_LIMIT_REST_MS = 60 * 60 * 1000;
/** The longest rest: a daily limit is over within a day. */
const MAX_REST_MS = 24 * 60 * 60 * 1000;
/** When the provider does not say how long to wait. */
export const LIMIT_REST_MS = 5 * 60 * 1000;
const MIN_REST_MS = 5 * 1000;

/** How long to leave a model alone after it hit its limit. */
export function limitRestMs(limit?: LimitHint): number {
  const said = limit?.retryAfterMs;
  if (limit?.daily) {
    // Gemini says when its daily limit resets ("retry in 22h38m"): rest until then.
    return said !== undefined && said > DAILY_LIMIT_REST_MS ? Math.min(said, MAX_REST_MS) : DAILY_LIMIT_REST_MS;
  }
  if (said !== undefined) return Math.min(Math.max(said, MIN_REST_MS), DAILY_LIMIT_REST_MS);
  return LIMIT_REST_MS;
}

/** The rests that are not over yet. Old ones are dropped so the list stays short. */
export function stillResting(limits: ModelLimits | undefined, now: number): ModelLimits {
  return Object.fromEntries(
    Object.entries(limits ?? {}).filter(([, until]) => new Date(until).getTime() > now),
  );
}

/**
 * Saves what a request learned about the keys it tried, so the Keys screen shows it and the
 * next request skips what cannot answer now.
 *
 * Make one per request: it remembers the rests it has already saved, so two models of one
 * key that hit their limits in the same request are both kept.
 */
export function keyProblemSaver(
  keys: ApiKeyRow[],
  updateKey: (id: string, patch: KeyPatch) => Promise<Result>,
  now: () => Date,
): (problem: KeyProblem) => Promise<void> {
  const saved = new Map<string, ModelLimits>();

  return async (problem) => {
    const at = now();
    if (problem.scope === 'key') {
      await updateKey(problem.keyId, {
        status: problem.status,
        last_error: problem.message,
        limited_at: problem.status === 'limited' ? at.toISOString() : null,
      });
      return;
    }
    // Only this model is resting; the key and its other models carry on.
    const before = saved.get(problem.keyId) ?? keys.find((key) => key.id === problem.keyId)?.model_limits;
    const limits = {
      ...stillResting(before, at.getTime()),
      [problem.model]: new Date(at.getTime() + limitRestMs(problem.limit)).toISOString(),
    };
    saved.set(problem.keyId, limits);
    await updateKey(problem.keyId, { model_limits: limits });
  };
}
