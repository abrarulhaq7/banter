import { effectiveModel } from '@/data';
import type { KeyCandidate } from '@/engine';
import type { ApiKeyRow, ModelRow } from '@/lib/database.types';

/** How long a key that hit its limit is left alone before it is tried again. */
export const LIMITED_REST_MS = 15 * 60 * 1000;

/**
 * The keys to try for a generation, in order.
 *
 * Active keys come first, in the user's order. A key that hit its limit is tried again
 * once it has rested for 15 minutes, after the active ones, because limits clear by
 * themselves. Rejected and switched-off keys are never tried.
 */
export function keyCandidates(keys: ApiKeyRow[], models: ModelRow[], now: number = Date.now()): KeyCandidate[] {
  const rested = (key: ApiKeyRow) =>
    key.status === 'limited' &&
    (key.limited_at === null || now - new Date(key.limited_at).getTime() >= LIMITED_REST_MS);

  const usable = [...keys.filter((key) => key.status === 'active'), ...keys.filter(rested)];

  return usable.flatMap((key) => {
    const model = effectiveModel(key, models);
    // Without a model list (first start, no internet, no saved copy) the key cannot be used.
    if (!model) return [];
    return [{ id: key.id, label: key.label, provider: key.provider, key: key.key, model: model.model_id }];
  });
}
