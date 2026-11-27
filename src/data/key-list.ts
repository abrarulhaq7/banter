import type { ApiKeyRow, ModelRow, ProviderId } from '@/lib/database.types';

/** The order of ids after moving one key up or down. Unchanged if it cannot move. */
export function moveInOrder(ids: string[], id: string, direction: 'up' | 'down'): string[] {
  const from = ids.indexOf(id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) return ids;

  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** The sort_order for a key added at the end of the list. */
export function nextSortOrder(keys: ApiKeyRow[]): number {
  return keys.reduce((highest, key) => Math.max(highest, key.sort_order), -1) + 1;
}

/** Best first: by rank across all providers. A model without a rank goes last. */
export function byRank(a: ModelRow, b: ModelRow): number {
  return (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.sort_order - b.sort_order;
}

/** One provider's models, best first. */
export function modelsFor(models: ModelRow[], provider: ProviderId): ModelRow[] {
  return models.filter((model) => model.provider === provider).sort(byRank);
}

/**
 * The models a key uses, best first: the one model chosen for it, or else (automatic)
 * all of its provider's. A chosen model that is no longer offered counts as automatic.
 */
export function keyModels(key: ApiKeyRow, models: ModelRow[]): ModelRow[] {
  const own = modelsFor(models, key.provider);
  const chosen = key.model ? own.find((model) => model.model_id === key.model) : undefined;
  return chosen ? [chosen] : own;
}

/** How a key's model reads in a list: the chosen model's name, or "Automatic". */
export function keyModelLabel(key: ApiKeyRow, models: ModelRow[]): string {
  const chosen = key.model ? modelsFor(models, key.provider).find((model) => model.model_id === key.model) : undefined;
  return chosen?.label ?? 'Automatic';
}

/** Until when a key leaves a model alone after it hit its limit. Null when it is not resting. */
export function restingUntil(key: ApiKeyRow, modelId: string, now: number): number | null {
  const until = key.model_limits?.[modelId];
  const time = until ? new Date(until).getTime() : NaN;
  return Number.isFinite(time) && time > now ? time : null;
}

/** The keys generation may use, in the order they are tried. */
export function usableKeys(keys: ApiKeyRow[]): ApiKeyRow[] {
  return keys.filter((key) => key.status === 'active');
}
