import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { createUserCache, dataErrorMessage, type UserCache } from '@/data';
import type { PersonRow } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

import { createHistoryRepo, type HistoryRepo, type InteractionWithLines } from './history-repo';
import { buildMemory, MEMORY_SIZE, type Memory } from './memory';
import { createOutbox, type Outbox } from './outbox';
import type { OutboxEntry, QueuedEntry } from './types';

type HistoryContextValue = {
  /** Everyone the user has used Banter with, most recent first. */
  people: PersonRow[];
  peopleStatus: 'loading' | 'ready';
  /** Set when the last refresh failed and the phone's saved copy is being shown. */
  loadError: string | null;
  /** Changes still waiting on the phone to be sent. */
  waiting: number;
  refreshPeople: () => Promise<void>;
  personByUsername: (username: string) => PersonRow | undefined;
  /** Queues a change and tries to send it at once. Never throws. */
  save: (entry: OutboxEntry) => Promise<void>;
  /**
   * The last interactions with this person, as prompt memory. Empty when offline.
   * `sameScreenshot`: ids of the sets already made for the screenshot being worked on.
   */
  memoryFor: (username: string, sameScreenshot?: ReadonlySet<string>) => Promise<Memory>;
  listInteractions: (personId: string) => Promise<InteractionWithLines[]>;
  screenshotUrl: (path: string) => Promise<string | null>;
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

const NO_MEMORY: Memory = { items: [], awaitingReplyLineId: null };
/** How many interactions the person timeline loads. */
const TIMELINE_SIZE = 50;

type HistoryProviderProps = {
  children: ReactNode;
  userId: string;
  /** Tests pass fakes. */
  repo?: HistoryRepo;
  outboxCache?: UserCache<QueuedEntry[]>;
  peopleCache?: UserCache<PersonRow[]>;
};

function defaultRepo(): HistoryRepo {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not connected');
  return createHistoryRepo(client);
}

/** History for the signed-in user: the people list, saving, and memory for prompts. */
export function HistoryProvider({ children, userId, repo, outboxCache, peopleCache }: HistoryProviderProps) {
  const [source] = useState(() => {
    const historyRepo = repo ?? defaultRepo();
    return {
      repo: historyRepo,
      people: peopleCache ?? createUserCache<PersonRow[]>('people', userId),
      outbox: createOutbox({
        repo: historyRepo,
        cache: outboxCache ?? createUserCache<QueuedEntry[]>('outbox', userId),
      }) as Outbox,
    };
  });
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [peopleStatus, setPeopleStatus] = useState<'loading' | 'ready'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);

  const refreshPeople = async (isCurrent: () => boolean = () => true) => {
    try {
      const fresh = await source.repo.listPeople();
      if (!isCurrent()) return;
      setPeople(fresh);
      setLoadError(null);
      await source.people.write(fresh);
    } catch (error) {
      if (isCurrent()) setLoadError(dataErrorMessage(error, 'load your people'));
    } finally {
      if (isCurrent()) setPeopleStatus('ready');
    }
  };

  /** Sends whatever is waiting, then refreshes the people list if anything went through. */
  const flush = async (isCurrent: () => boolean = () => true) => {
    const result = await source.outbox.flush();
    if (!isCurrent()) return;
    setWaiting(result.waiting);
    if (result.sent > 0) await refreshPeople(isCurrent);
  };

  useEffect(() => {
    let current = true;
    void (async () => {
      const cached = await source.people.read();
      if (!current) return;
      if (cached) {
        setPeople(cached);
        setPeopleStatus('ready');
      }
      // Anything left from last time goes first, so the list that follows is complete.
      await flush(() => current);
      await refreshPeople(() => current);
    })();
    return () => {
      current = false;
    };
    // Runs once per user: the provider is remounted with a new key when the user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: HistoryContextValue = {
    people,
    peopleStatus,
    loadError,
    waiting,
    refreshPeople: () => refreshPeople(),
    personByUsername: (username) => people.find((person) => person.username === username),

    async save(entry) {
      await source.outbox.add(entry);
      setWaiting(await source.outbox.waiting());
      await flush();
    },

    async memoryFor(username, sameScreenshot) {
      const person = people.find((item) => item.username === username);
      if (!person) return NO_MEMORY;
      try {
        return buildMemory(await source.repo.listInteractions(person.id, MEMORY_SIZE), sameScreenshot);
      } catch {
        // No connection: lines are still written, just without the history.
        return NO_MEMORY;
      }
    },

    listInteractions: (personId) => source.repo.listInteractions(personId, TIMELINE_SIZE),
    screenshotUrl: (path) => source.repo.screenshotUrl(path),
  };

  return <HistoryContext value={value}>{children}</HistoryContext>;
}

export function useHistory(): HistoryContextValue {
  const value = use(HistoryContext);
  if (!value) throw new Error('useHistory must be used inside <HistoryProvider>');
  return value;
}
