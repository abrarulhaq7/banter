import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { createUserCache, dataErrorMessage, type Result, type UserCache } from '@/data';
import type { UserPromptRow } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

import { createPromptsRepo, type PromptsRepo } from './prompts-repo';
import { resolvePrompts } from './resolve';
import type { CachedPrompts, ResolvedPrompts } from './types';

type PromptsContextValue = ResolvedPrompts & {
  status: 'loading' | 'ready';
  /** Set when the last refresh failed and the phone's saved copy (or the app's own) is in use. */
  loadError: string | null;
  refresh: () => Promise<void>;
  /** Saves the user's own definition of one of Banter's tones. */
  saveToneDefinition: (toneId: string, definition: string) => Promise<Result>;
  /** Back to Banter's definition. */
  resetTone: (toneId: string) => Promise<Result>;
  addCustomTone: (label: string, definition: string) => Promise<Result>;
  updateCustomTone: (id: string, label: string, definition: string) => Promise<Result>;
  removeCustomTone: (id: string) => Promise<Result>;
};

const PromptsContext = createContext<PromptsContextValue | null>(null);

type PromptsProviderProps = {
  children: ReactNode;
  userId: string;
  /** Tests pass fakes. */
  repo?: PromptsRepo;
  cache?: UserCache<CachedPrompts>;
};

function defaultRepo(): PromptsRepo {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not connected');
  return createPromptsRepo(client);
}

const EMPTY: CachedPrompts = { defaults: null, userPrompts: [] };

const failed = (error: unknown, action: string): Result => ({ ok: false, message: dataErrorMessage(error, action) });

/**
 * The prompts for the signed-in user: Banter's defaults from Supabase, with the user's own
 * tones on top. A copy is kept on the phone, and the copy built into the app is used until
 * anything has loaded, so there is always a prompt to send.
 */
export function PromptsProvider({ children, userId, repo, cache }: PromptsProviderProps) {
  const [source] = useState(() => ({
    repo: repo ?? defaultRepo(),
    cache: cache ?? createUserCache<CachedPrompts>('prompts', userId),
  }));
  const [data, setData] = useState<CachedPrompts>(EMPTY);
  const [status, setStatus] = useState<PromptsContextValue['status']>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = async (next: CachedPrompts) => {
    setData(next);
    await source.cache.write(next);
  };

  const applyUserPrompts = (change: (rows: UserPromptRow[]) => UserPromptRow[]) =>
    apply({ ...data, userPrompts: change(data.userPrompts) });

  const fetchFresh = async (isCurrent: () => boolean = () => true) => {
    try {
      const [defaults, userPrompts] = await Promise.all([source.repo.loadDefaults(), source.repo.listUserPrompts()]);
      if (!isCurrent()) return;
      setLoadError(null);
      await apply({ defaults, userPrompts });
    } catch (caught) {
      if (isCurrent()) setLoadError(dataErrorMessage(caught, 'load your tones'));
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

  const resolved = resolvePrompts(data.defaults, data.userPrompts);

  const value: PromptsContextValue = {
    ...resolved,
    status,
    loadError,
    refresh: () => fetchFresh(),

    async saveToneDefinition(toneId, definition) {
      const content = definition.trim();
      const tone = resolved.tones.find((item) => item.toneId === toneId);
      try {
        // Saving Banter's own words again is the same as having no version of your own.
        if (tone && content === tone.defaultDefinition?.trim()) {
          if (tone.userPromptId) {
            await source.repo.remove(tone.userPromptId);
            await applyUserPrompts((rows) => rows.filter((row) => row.id !== tone.userPromptId));
          }
          return { ok: true };
        }
        const saved = tone?.userPromptId
          ? await source.repo.update(tone.userPromptId, { content })
          : await source.repo.addToneVersion(toneId, content);
        await applyUserPrompts((rows) => [...rows.filter((row) => row.id !== saved.id), saved]);
        return { ok: true };
      } catch (caught) {
        return failed(caught, 'save the tone');
      }
    },

    async resetTone(toneId) {
      const own = data.userPrompts.find((row) => row.tone_id === toneId);
      if (!own) return { ok: true };
      try {
        await source.repo.remove(own.id);
        await applyUserPrompts((rows) => rows.filter((row) => row.id !== own.id));
        return { ok: true };
      } catch (caught) {
        return failed(caught, 'reset the tone');
      }
    },

    async addCustomTone(label, definition) {
      try {
        const saved = await source.repo.addCustomTone(label.trim(), definition.trim());
        await applyUserPrompts((rows) => [...rows, saved]);
        return { ok: true };
      } catch (caught) {
        return failed(caught, 'save the tone');
      }
    },

    async updateCustomTone(id, label, definition) {
      try {
        const saved = await source.repo.update(id, { label: label.trim(), content: definition.trim() });
        await applyUserPrompts((rows) => rows.map((row) => (row.id === id ? saved : row)));
        return { ok: true };
      } catch (caught) {
        return failed(caught, 'save the tone');
      }
    },

    async removeCustomTone(id) {
      try {
        await source.repo.remove(id);
        await applyUserPrompts((rows) => rows.filter((row) => row.id !== id));
        return { ok: true };
      } catch (caught) {
        return failed(caught, 'delete the tone');
      }
    },
  };

  return <PromptsContext value={value}>{children}</PromptsContext>;
}

export function usePrompts(): PromptsContextValue {
  const value = use(PromptsContext);
  if (!value) throw new Error('usePrompts must be used inside <PromptsProvider>');
  return value;
}
