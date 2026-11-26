import type {
  ContextId,
  InteractionInsert,
  InteractionRow,
  LineInsert,
  LinePatch,
  LineRow,
  PersonRow,
} from '@/lib/database.types';
import type { BanterClient } from '@/lib/supabase';

export const SCREENSHOT_BUCKET = 'screenshots';

export type InteractionWithLines = InteractionRow & { lines: LineRow[] };

/**
 * Every read and write of history in Supabase. Each function throws the Supabase error on
 * failure. Row-level security limits all of it to the signed-in user's own rows and files.
 */
export type HistoryRepo = {
  /** Finds the person with this username, or creates them. Returns their id. */
  upsertPerson: (username: string, context: ContextId | null, at: string) => Promise<string>;
  saveInteraction: (row: InteractionInsert) => Promise<void>;
  saveLines: (rows: LineInsert[]) => Promise<void>;
  /** True when a file is already stored at this path. */
  screenshotExists: (path: string) => Promise<boolean>;
  /** Reads the resized image from the phone and stores it. */
  uploadScreenshot: (path: string, localUri: string) => Promise<void>;
  patchLine: (lineId: string, patch: LinePatch) => Promise<void>;
  assignPerson: (interactionIds: string[], personId: string) => Promise<void>;
  setPersonContext: (personId: string, context: ContextId) => Promise<void>;
  /** Deletes this person if nothing is saved under them: no interactions and no notes. */
  removePersonIfEmpty: (username: string) => Promise<void>;

  listPeople: () => Promise<PersonRow[]>;
  /** Newest first. */
  listInteractions: (personId: string, limit: number) => Promise<InteractionWithLines[]>;
  /** A link to a stored screenshot that works for a short time. */
  screenshotUrl: (path: string) => Promise<string | null>;
};

export function createHistoryRepo(client: BanterClient): HistoryRepo {
  return {
    async upsertPerson(username, context, at) {
      const row = { username, last_interaction_at: at, ...(context ? { context } : {}) };
      const { data, error } = await client
        .from('people')
        .upsert(row, { onConflict: 'user_id,username' })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },

    async saveInteraction(row) {
      const { error } = await client.from('interactions').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    },

    async saveLines(rows) {
      if (rows.length === 0) return;
      // The first save wins: sending a queued entry again must not undo a later
      // "copied" or "kept" mark.
      const { error } = await client.from('lines').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    },

    async screenshotExists(path) {
      const slash = path.lastIndexOf('/');
      const { data, error } = await client.storage
        .from(SCREENSHOT_BUCKET)
        .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
      if (error) throw error;
      return data.some((file) => file.name === path.slice(slash + 1));
    },

    async uploadScreenshot(path, localUri) {
      const file = await fetch(localUri);
      const bytes = await file.arrayBuffer();
      const { error } = await client.storage
        .from(SCREENSHOT_BUCKET)
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
    },

    async patchLine(lineId, patch) {
      const { error } = await client.from('lines').update(patch).eq('id', lineId);
      if (error) throw error;
    },

    async assignPerson(interactionIds, personId) {
      if (interactionIds.length === 0) return;
      const { error } = await client.from('interactions').update({ person_id: personId }).in('id', interactionIds);
      if (error) throw error;
    },
    async removePersonIfEmpty(username) {
      const found = await client.from('people').select('id, notes').eq('username', username).maybeSingle();
      if (found.error) throw found.error;
      if (!found.data || found.data.notes) return;
      const used = await client
        .from('interactions')
        .select('id', { count: 'exact', head: true })
        .eq('person_id', found.data.id);
      if (used.error) throw used.error;
      if (used.count !== 0) return;
      const { error } = await client.from('people').delete().eq('id', found.data.id);
      if (error) throw error;
    },

    async setPersonContext(personId, context) {
      const { error } = await client.from('people').update({ context }).eq('id', personId);
      if (error) throw error;
    },

    async listPeople() {
      const { data, error } = await client
        .from('people')
        .select('*')
        .order('last_interaction_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },

    async listInteractions(personId, limit) {
      const { data, error } = await client
        .from('interactions')
        .select('*, lines(*)')
        .eq('person_id', personId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as unknown as InteractionWithLines[]).map((row) => ({
        ...row,
        lines: [...row.lines].sort((a, b) => a.position - b.position),
      }));
    },

    async screenshotUrl(path) {
      const { data, error } = await client.storage.from(SCREENSHOT_BUCKET).createSignedUrl(path, 60 * 60);
      return error ? null : data.signedUrl;
    },
  };
}
