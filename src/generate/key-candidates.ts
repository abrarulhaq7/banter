import { byRank, keyModels, restingUntil } from '@/data';
import type { KeyCandidate } from '@/engine';
import type { ApiKeyRow, ModelRow } from '@/lib/database.types';

/** How long a key that hit a limit on the whole key (no credit) is left alone. */
export const LIMITED_REST_MS = 15 * 60 * 1000;

/**
 * What to try for a request, in order: each usable key with each model it uses.
 *
 * The best model goes first, across all keys and providers (`models.rank`). Of two keys
 * with the same model, an active key goes before one coming back from a limit, and then
 * the one higher in the user's list. A model that hit its limit is left alone until its
 * rest is over; resting models are still offered last, soonest back first, so a request
 * gets the provider's own answer rather than none at all.
 *
 * Rejected and switched-off keys are never tried. A key that ran out of credit is tried
 * again once it has rested for 15 minutes.
 */
export function keyCandidates(keys: ApiKeyRow[], models: ModelRow[], now: number = Date.now()): KeyCandidate[] {
  const rested = (key: ApiKeyRow) =>
    key.status === 'limited' &&
    (key.limited_at === null || now - new Date(key.limited_at).getTime() >= LIMITED_REST_MS);

  const choices = keys.flatMap((key, place) =>
    key.status === 'active' || rested(key)
      ? keyModels(key, models).map((model) => ({ key, model, place, until: restingUntil(key, model.model_id, now) }))
      : [],
  );
  type Choice = (typeof choices)[number];

  const ready = choices
    .filter((choice) => choice.until === null)
    .sort(
      (a, b) =>
        byRank(a.model, b.model) ||
        Number(a.key.status !== 'active') - Number(b.key.status !== 'active') ||
        a.place - b.place,
    );
  const resting = choices
    .filter((choice): choice is Choice & { until: number } => choice.until !== null)
    .sort((a, b) => a.until - b.until);

  return [...ready, ...resting].map(({ key, model }) => ({
    id: key.id,
    label: key.label,
    provider: key.provider,
    key: key.key,
    model: model.model_id,
  }));
}
