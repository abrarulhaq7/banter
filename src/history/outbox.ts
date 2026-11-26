import { dataErrorMessage } from '@/data';
import type { UserCache } from '@/data';
import { uuid } from '@/lib/uuid';

import type { HistoryRepo } from './history-repo';
import type { OutboxEntry, QueuedEntry } from './types';

/**
 * The queue of history changes waiting to reach Supabase.
 *
 * Entries are sent in the order they were made. If one cannot be sent because there is no
 * connection, sending stops and everything waits on the phone for the next try. An entry
 * the database refuses for good (a rule it breaks) is dropped, so it cannot block the rest.
 */

export type FlushResult = {
  sent: number;
  waiting: number;
  /** Set when sending stopped early. */
  problem: string | null;
};

export type Outbox = {
  add: (entry: OutboxEntry) => Promise<void>;
  flush: () => Promise<FlushResult>;
  waiting: () => Promise<number>;
};

type Options = {
  repo: HistoryRepo;
  cache: UserCache<QueuedEntry[]>;
  now?: () => Date;
};

/** True for problems that may go away: no connection, a timeout, a server having trouble. */
function isTemporary(error: unknown): boolean {
  const info = (error ?? {}) as { message?: unknown; status?: unknown; statusCode?: unknown; code?: unknown };
  const status = Number(info.status ?? info.statusCode);
  if (status >= 500 || status === 408 || status === 429 || status === 401) return true;
  // A database or storage rule was broken: retrying will never help.
  if (typeof info.code === 'string' && /^(22|23|42)/.test(info.code)) return false;
  if (status >= 400 && status < 500) return false;
  const message = typeof info.message === 'string' ? info.message : '';
  return /network|fetch|timeout|connection|abort/i.test(message) || !info.code;
}

export function createOutbox({ repo, cache, now = () => new Date() }: Options): Outbox {
  let entries: QueuedEntry[] | null = null;
  let flushing: Promise<FlushResult> | null = null;

  const load = async () => {
    entries ??= (await cache.read()) ?? [];
    return entries;
  };
  const persist = async () => {
    await cache.write(entries ?? []);
  };

  /** Sends one entry. Throws if it could not be sent. */
  const send = async (entry: QueuedEntry) => {
    switch (entry.kind) {
      case 'generation': {
        const personId = entry.username
          ? await repo.upsertPerson(entry.username, entry.context, entry.interaction.created_at ?? entry.queuedAt)
          : null;

        // The screenshot goes first: the interaction row points at it.
        let screenshotPath: string | null = entry.screenshot?.path ?? null;
        if (entry.screenshot && !(await repo.screenshotExists(entry.screenshot.path))) {
          try {
            await repo.uploadScreenshot(entry.screenshot.path, entry.screenshot.localUri);
          } catch (error) {
            if (isTemporary(error)) throw error;
            // The file is gone from the phone or was refused. Save the lines without it.
            screenshotPath = null;
          }
        }

        await repo.saveInteraction({ ...entry.interaction, person_id: personId, screenshot_path: screenshotPath });
        await repo.saveLines(entry.lines);
        return;
      }
      case 'linePatch':
        await repo.patchLine(entry.lineId, entry.patch);
        return;
      case 'assignPerson': {
        const personId = await repo.upsertPerson(entry.username, entry.context, entry.queuedAt);
        await repo.assignPerson(entry.interactionIds, personId);
        // A username the AI misread would otherwise stay in the People list with nothing in it.
        if (entry.previousUsername && entry.previousUsername !== entry.username) {
          await repo.removePersonIfEmpty(entry.previousUsername);
        }
        return;
      }
      case 'personContext': {
        const personId = await repo.upsertPerson(entry.username, entry.context, entry.queuedAt);
        await repo.setPersonContext(personId, entry.context);
        return;
      }
    }
  };

  const run = async (): Promise<FlushResult> => {
    const queue = await load();
    let sent = 0;
    while (queue.length > 0) {
      try {
        await send(queue[0]);
        sent += 1;
      } catch (error) {
        if (isTemporary(error)) {
          await persist();
          return { sent, waiting: queue.length, problem: dataErrorMessage(error, 'save your history') };
        }
        // Refused for good. Drop it so the entries behind it are not stuck forever.
      }
      queue.shift();
      await persist();
    }
    return { sent, waiting: 0, problem: null };
  };

  return {
    async add(entry) {
      const queue = await load();
      queue.push({ ...entry, entryId: uuid(), queuedAt: now().toISOString() });
      await persist();
    },

    flush() {
      // One sender at a time, so entries can never be sent out of order.
      flushing ??= run().finally(() => {
        flushing = null;
      });
      return flushing;
    },

    async waiting() {
      return (await load()).length;
    },
  };
}
