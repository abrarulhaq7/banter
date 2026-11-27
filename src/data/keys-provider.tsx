import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';

import type { ApiKeyRow, ModelRow, ProviderId } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

import { moveInOrder, nextSortOrder } from './key-list';
import { createKeysRepo, type KeyPatch, type KeysRepo } from './repos';
import { dataErrorMessage, failure, type Result } from './result';
import { createUserCache, type UserCache } from './user-cache';

export type CachedKeys = { keys: ApiKeyRow[]; models: ModelRow[] };

export type NewKeyInput = {
  provider: ProviderId;
  label: string;
  key: string;
  model: string | null;
};

type KeysContextValue = {
  status: 'loading' | 'ready';
  /** In the order they are tried. */
  keys: ApiKeyRow[];
  models: ModelRow[];
  /** Set when the last refresh failed and the phone's saved copy is being shown. */
  loadError: string | null;
  refresh: () => Promise<void>;
  addKey: (input: NewKeyInput) => Promise<Result>;
  updateKey: (id: string, patch: KeyPatch) => Promise<Result>;
  removeKey: (id: string) => Promise<Result>;
  moveKey: (id: string, direction: 'up' | 'down') => Promise<Result>;
};

const KeysContext = createContext<KeysContextValue | null>(null);

type KeysProviderProps = {
  children: ReactNode;
  userId: string;
  /** Tests pass fakes. */
  repo?: KeysRepo;
  cache?: UserCache<CachedKeys>;
};

function defaultRepo(): KeysRepo {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not connected');
  return createKeysRepo(client);
}

/**
 * The user's API keys and the model list. Supabase holds them; a copy is kept in the
 * phone's secure storage so they are there at once on start and without internet.
 */
export function KeysProvider({ children, userId, repo, cache }: KeysProviderProps) {
  const [source] = useState(() => ({
    repo: repo ?? defaultRepo(),
    cache: cache ?? createUserCache<CachedKeys>('keys', userId),
  }));
  const [data, setDataState] = useState<CachedKeys>({ keys: [], models: [] });
  const [status, setStatus] = useState<KeysContextValue['status']>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  // The newest list, for changes made one after another before the screen redraws: one
  // request can save a limit on several keys, and each change must build on the last.
  const latest = useRef(data);
  const setData = (next: CachedKeys) => {
    latest.current = next;
    setDataState(next);
  };

  /** Shows the new list and saves it on the phone. */
  const apply = async (next: CachedKeys) => {
    setData(next);
    await source.cache.write(next);
  };

  const fetchFresh = async (isCurrent: () => boolean = () => true) => {
    try {
      const [keys, models] = await Promise.all([source.repo.list(), source.repo.listModels()]);
      if (!isCurrent()) return;
      setLoadError(null);
      await apply({ keys, models });
    } catch (caught) {
      if (!isCurrent()) return;
      setLoadError(dataErrorMessage(caught, 'load your keys'));
    } finally {
      if (isCurrent()) setStatus('ready');
    }
  };

  useEffect(() => {
    let current = true;
    void (async () => {
      const cached = await source.cache.read();
      if (!current) return;
      if (cached) {
        setData(cached);
        setStatus('ready');
      }
      await fetchFresh(() => current);
    })();
    return () => {
      current = false;
    };
    // Runs once per user: the provider is remounted with a new key when the user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: KeysContextValue = {
    status,
    keys: data.keys,
    models: data.models,
    loadError,
    refresh: () => fetchFresh(),

    async addKey(input) {
      try {
        const added = await source.repo.add({ ...input, sort_order: nextSortOrder(latest.current.keys) });
        await apply({ ...latest.current, keys: [...latest.current.keys, added] });
        return { ok: true };
      } catch (caught) {
        return failure(caught, 'save the key');
      }
    },

    async updateKey(id, patch) {
      try {
        const updated = await source.repo.update(id, patch);
        await apply({ ...latest.current, keys: latest.current.keys.map((key) => (key.id === id ? updated : key)) });
        return { ok: true };
      } catch (caught) {
        return failure(caught, 'save the change');
      }
    },

    async removeKey(id) {
      try {
        await source.repo.remove(id);
        await apply({ ...latest.current, keys: latest.current.keys.filter((key) => key.id !== id) });
        return { ok: true };
      } catch (caught) {
        return failure(caught, 'delete the key');
      }
    },

    async moveKey(id, direction) {
      const before = latest.current.keys.map((key) => key.id);
      const after = moveInOrder(before, id, direction);
      if (after === before) return { ok: true };

      const previous = latest.current;
      const reordered = after.map((keyId, index) => ({
        ...latest.current.keys.find((key) => key.id === keyId)!,
        sort_order: index,
      }));
      // Show the new order at once; put the old one back if saving fails.
      setData({ ...latest.current, keys: reordered });
      try {
        await source.repo.setOrder(after);
        await source.cache.write({ ...latest.current, keys: reordered });
        return { ok: true };
      } catch (caught) {
        setData(previous);
        return failure(caught, 'save the new order');
      }
    },
  };

  return <KeysContext value={value}>{children}</KeysContext>;
}

export function useKeys(): KeysContextValue {
  const value = use(KeysContext);
  if (!value) throw new Error('useKeys must be used inside <KeysProvider>');
  return value;
}
