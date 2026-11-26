import type { ApiKeyRow, ModelRow, ProfileRow, ProviderId } from '@/lib/database.types';
import type { BanterClient } from '@/lib/supabase';

/**
 * Every read and write the app makes to Supabase in this phase. Each function throws
 * the Supabase error on failure; callers turn it into a message with dataErrorMessage().
 * Row-level security limits every query to the signed-in user's own rows.
 */

export type NewKey = {
  provider: ProviderId;
  label: string;
  key: string;
  model: string | null;
  sort_order: number;
};

export type KeyPatch = Partial<Pick<ApiKeyRow, 'label' | 'model' | 'status' | 'last_error'>>;

export type ProfilePatch = Partial<
  Pick<
    ProfileRow,
    'display_name' | 'age' | 'city' | 'work' | 'interests' | 'texting_style' | 'theme' | 'onboarded_at'
  >
>;

export type KeysRepo = {
  list: () => Promise<ApiKeyRow[]>;
  add: (input: NewKey) => Promise<ApiKeyRow>;
  update: (id: string, patch: KeyPatch) => Promise<ApiKeyRow>;
  remove: (id: string) => Promise<void>;
  /** Saves the order of the keys: the first id is tried first. */
  setOrder: (ids: string[]) => Promise<void>;
  listModels: () => Promise<ModelRow[]>;
};

export type ProfileRepo = {
  get: (userId: string) => Promise<ProfileRow>;
  update: (userId: string, patch: ProfilePatch) => Promise<ProfileRow>;
};

export function createKeysRepo(client: BanterClient): KeysRepo {
  return {
    async list() {
      const { data, error } = await client
        .from('api_keys')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    async add(input) {
      const { data, error } = await client.from('api_keys').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, patch) {
      const { data, error } = await client.from('api_keys').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await client.from('api_keys').delete().eq('id', id);
      if (error) throw error;
    },
    async setOrder(ids) {
      for (const [index, id] of ids.entries()) {
        const { error } = await client.from('api_keys').update({ sort_order: index }).eq('id', id);
        if (error) throw error;
      }
    },
    async listModels() {
      const { data, error } = await client
        .from('models')
        .select('*')
        .eq('is_active', true)
        .order('provider', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  };
}

export function createProfileRepo(client: BanterClient): ProfileRepo {
  return {
    async get(userId) {
      const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      return data;
    },
    async update(userId, patch) {
      const { data, error } = await client
        .from('profiles')
        .update(patch)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  };
}
