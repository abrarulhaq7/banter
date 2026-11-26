import type { UserPromptRow } from '@/lib/database.types';
import type { BanterClient } from '@/lib/supabase';

import type { RemoteDefaults } from './types';

/**
 * Reads the default prompts and reads and writes the user's own tones. Each function
 * throws the Supabase error on failure. The defaults are read-only for the app;
 * row-level security limits `user_prompts` to the signed-in user's own rows.
 */
export type PromptsRepo = {
  loadDefaults: () => Promise<RemoteDefaults>;
  listUserPrompts: () => Promise<UserPromptRow[]>;
  /** The user's own version of a default tone. */
  addToneVersion: (toneId: string, content: string) => Promise<UserPromptRow>;
  addCustomTone: (label: string, content: string) => Promise<UserPromptRow>;
  update: (id: string, patch: { label?: string; content?: string }) => Promise<UserPromptRow>;
  remove: (id: string) => Promise<void>;
};

export function createPromptsRepo(client: BanterClient): PromptsRepo {
  return {
    async loadDefaults() {
      const [core, modes, tones] = await Promise.all([
        client.from('prompt_core').select('version, rules, output_format').eq('is_active', true).maybeSingle(),
        client.from('modes').select('id, label, instruction, sort_order').eq('is_active', true),
        client.from('tones').select('id, label, definition, sort_order').eq('is_active', true),
      ]);
      if (core.error) throw core.error;
      if (modes.error) throw modes.error;
      if (tones.error) throw tones.error;
      return { core: core.data, modes: modes.data, tones: tones.data };
    },

    async listUserPrompts() {
      const { data, error } = await client.from('user_prompts').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },

    async addToneVersion(toneId, content) {
      const { data, error } = await client.from('user_prompts').insert({ tone_id: toneId, content }).select().single();
      if (error) throw error;
      return data;
    },

    async addCustomTone(label, content) {
      const { data, error } = await client.from('user_prompts').insert({ label, content }).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, patch) {
      const { data, error } = await client.from('user_prompts').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await client.from('user_prompts').delete().eq('id', id);
      if (error) throw error;
    },
  };
}
