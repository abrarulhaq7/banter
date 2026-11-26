import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import type { ProfileRow } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

import { createProfileRepo, type ProfilePatch, type ProfileRepo } from './repos';
import { dataErrorMessage, failure, type Result } from './result';
import { createUserCache, type UserCache } from './user-cache';

type ProfileContextValue = {
  /** 'error' means the profile could not be loaded and there is no saved copy. */
  status: 'loading' | 'ready' | 'error';
  profile: ProfileRow | null;
  error: string | null;
  reload: () => Promise<void>;
  save: (patch: ProfilePatch) => Promise<Result>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

type ProfileProviderProps = {
  children: ReactNode;
  userId: string;
  /** Tests pass fakes. */
  repo?: ProfileRepo;
  cache?: UserCache<ProfileRow>;
};

function defaultRepo(): ProfileRepo {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not connected');
  return createProfileRepo(client);
}

/** Loads the signed-in user's profile: the phone's copy first, then the server's. */
export function ProfileProvider({ children, userId, repo, cache }: ProfileProviderProps) {
  const [source] = useState(() => ({
    repo: repo ?? defaultRepo(),
    cache: cache ?? createUserCache<ProfileRow>('profile', userId),
  }));
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [status, setStatus] = useState<ProfileContextValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = async (isCurrent: () => boolean = () => true) => {
    const cached = await source.cache.read();
    if (!isCurrent()) return;
    if (cached) {
      setProfile(cached);
      setStatus('ready');
    }

    try {
      const fresh = await source.repo.get(userId);
      if (!isCurrent()) return;
      setProfile(fresh);
      setStatus('ready');
      setError(null);
      await source.cache.write(fresh);
    } catch (caught) {
      if (!isCurrent()) return;
      setError(dataErrorMessage(caught, 'load your profile'));
      // With a saved copy the app carries on; without one there is nothing to show.
      if (!cached) setStatus('error');
    }
  };

  useEffect(() => {
    let current = true;
    void (async () => {
      await load(() => current);
    })();
    return () => {
      current = false;
    };
    // Runs once per user: the provider is remounted with a new key when the user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: ProfileContextValue = {
    status,
    profile,
    error,
    async reload() {
      setStatus((previous) => (previous === 'error' ? 'loading' : previous));
      await load();
    },
    async save(patch) {
      try {
        const saved = await source.repo.update(userId, patch);
        setProfile(saved);
        setStatus('ready');
        await source.cache.write(saved);
        return { ok: true };
      } catch (caught) {
        return failure(caught, 'save your profile');
      }
    },
  };

  return <ProfileContext value={value}>{children}</ProfileContext>;
}

export function useProfile(): ProfileContextValue {
  const value = use(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside <ProfileProvider>');
  return value;
}
