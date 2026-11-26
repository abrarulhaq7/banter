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

export function modelsFor(models: ModelRow[], provider: ProviderId): ModelRow[] {
  return models.filter((model) => model.provider === provider);
}

export function defaultModelFor(models: ModelRow[], provider: ProviderId): ModelRow | undefined {
  const own = modelsFor(models, provider);
  return own.find((model) => model.is_default) ?? own[0];
}

/** The model a key will actually use: its own choice, or the provider's default. */
export function effectiveModel(key: ApiKeyRow, models: ModelRow[]): ModelRow | undefined {
  const own = modelsFor(models, key.provider);
  return own.find((model) => model.model_id === key.model) ?? defaultModelFor(models, key.provider);
}

/** The keys generation may use, in the order they are tried. */
export function usableKeys(keys: ApiKeyRow[]): ApiKeyRow[] {
  return keys.filter((key) => key.status === 'active');
}
