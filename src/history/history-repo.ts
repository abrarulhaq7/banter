import type {
  ContextId,
  InteractionInsert,
  InteractionRow,
  LineInsert,
  LinePatch,
  LineRow,
  PersonRow,
  UsageRow,
} from '@/lib/database.types';
import type { BanterClient } from '@/lib/supabase';

export const SCREENSHOT_BUCKET = 'screenshots';

export type InteractionWithLines = InteractionRow & { lines: LineRow[] };

/** A line the user saved (kept), with who it was for and how it was written. */
export type SavedLine = {
  id: string;
  text: string;
  keptAt: string;
  copiedAt: string | null;
  interactionId: string;
  toneLabel: string | null;
  modeId: string;
  /** Null when the username could not be read. */
  personId: string | null;
  username: string | null;
};

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
  /** The user's note about someone already saved. Null removes it. */
  setPersonNotes: (username: string, notes: string | null) => Promise<void>;
  /** Deletes this person if nothing is saved under them: no interactions and no notes. */
  removePersonIfEmpty: (username: string) => Promise<void>;

  listPeople: () => Promise<PersonRow[]>;
  /** Newest first. */
  listInteractions: (personId: string, limit: number) => Promise<InteractionWithLines[]>;
  /** Deletes a person with everything saved under them, and the screenshots stored for them. */
  deletePerson: (personId: string) => Promise<void>;
  /** Deletes every person, interaction, line and stored screenshot of this user. */
  deleteAllHistory: (userId: string) => Promise<void>;
  /** Deletes the stored screenshots, then the login itself and, with it, every row. */
  deleteAccount: (userId: string) => Promise<void>;
  /** Generations per provider, model and key, most used first. */
  usage: () => Promise<UsageRow[]>;
  /** Every line the user saved, with anyone, the most recently saved first. */
  listSaved: (limit: number) => Promise<SavedLine[]>;
  /** The user's latest interactions with anyone, newest first. */
  listRecent: (limit: number) => Promise<InteractionWithLines[]>;
  /** A link to a stored screenshot that works for a short time. */
  screenshotUrl: (path: string) => Promise<string | null>;
};

export function createHistoryRepo(client: BanterClient): HistoryRepo {
  const bucket = () => client.storage.from(SCREENSHOT_BUCKET);

  const removeFiles = async (paths: string[]) => {
    for (let at = 0; at < paths.length; at += 100) {
      const { error } = await bucket().remove(paths.slice(at, at + 100));
      if (error) throw error;
    }
  };

  /** Removes every file in the user's folder, however many there are. */
  const removeAllFiles = async (userId: string) => {
    for (;;) {
      const { data, error } = await bucket().list(userId, { limit: 100 });
      if (error) throw error;
      if (data.length === 0) return;
      await removeFiles(data.map((file) => `${userId}/${file.name}`));
    }
  };

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
      // The lines are always worth keeping, even when a tone they point at is missing:
      // - the user's own tone was deleted while this waited on the phone without internet;
      // - a tone new in this version of the app is not in Supabase's tones table yet.
      // Then the link is dropped and the row saved again. The tone's name is kept either way.
      let next = row;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error } = await client.from('interactions').upsert(next, { onConflict: 'id' });
        if (!error) return;
        const about = `${error.message} ${error.details ?? ''}`;
        if (error.code !== '23503') throw error;
        if (next.user_prompt_id && /user_prompt/.test(about)) next = { ...next, user_prompt_id: null };
        else if (next.tone_id && /tone_id/.test(about)) next = { ...next, tone_id: null };
        else throw error;
      }
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

    async setPersonNotes(username, notes) {
      const { error } = await client.from('people').update({ notes }).eq('username', username);
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

    async deletePerson(personId) {
      const found = await client
        .from('interactions')
        .select('screenshot_path')
        .eq('person_id', personId)
        .not('screenshot_path', 'is', null);
      if (found.error) throw found.error;
      // The rows go first: that is what the user asked for. A file left behind by a failed
      // second step is invisible, and "Delete all history" clears the whole folder.
      const { error } = await client.from('people').delete().eq('id', personId);
      if (error) throw error;
      const paths = [...new Set(found.data.map((row) => row.screenshot_path).filter((path): path is string => !!path))];
      await removeFiles(paths);
    },

    async deleteAllHistory(userId) {
      // Lines go with their interactions. Interactions with no person are deleted too.
      const interactions = await client.from('interactions').delete().not('id', 'is', null);
      if (interactions.error) throw interactions.error;
      const people = await client.from('people').delete().not('id', 'is', null);
      if (people.error) throw people.error;
      await removeAllFiles(userId);
    },

    async deleteAccount(userId) {
      // Files are not rows: they would outlive the account if they were not removed first.
      await removeAllFiles(userId);
      const { error } = await client.rpc('delete_my_account');
      if (error) throw error;
    },

    async usage() {
      const { data, error } = await client
        .from('usage_summary')
        .select('provider, model, key_label, generations, this_month, last_used_at')
        .order('generations', { ascending: false });
      if (error) throw error;
      return data;
    },

    async listSaved(limit) {
      const { data, error } = await client
        .from('lines')
        .select('id, text, kept_at, copied_at, interaction_id, interactions(mode_id, tone_label, person_id, people(username))')
        .not('kept_at', 'is', null)
        .order('kept_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      type Raw = {
        id: string;
        text: string;
        kept_at: string;
        copied_at: string | null;
        interaction_id: string;
        interactions: {
          mode_id: string;
          tone_label: string | null;
          person_id: string | null;
          people: { username: string } | null;
        } | null;
      };
      return (data as unknown as Raw[]).map((row) => ({
        id: row.id,
        text: row.text,
        keptAt: row.kept_at,
        copiedAt: row.copied_at,
        interactionId: row.interaction_id,
        toneLabel: row.interactions?.tone_label ?? null,
        modeId: row.interactions?.mode_id ?? 'story_reply',
        personId: row.interactions?.person_id ?? null,
        username: row.interactions?.people?.username ?? null,
      }));
    },

    async listRecent(limit) {
      const { data, error } = await client
        .from('interactions')
        .select('*, lines(*)')
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
