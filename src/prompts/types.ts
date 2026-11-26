import type { ModeId, PromptCore } from '@/engine';
import type { ModeRow, PromptCoreRow, ToneRow, UserPromptRow } from '@/lib/database.types';

/** The default prompts as Supabase holds them. */
export type RemoteDefaults = {
  core: Pick<PromptCoreRow, 'version' | 'rules' | 'output_format'> | null;
  modes: Pick<ModeRow, 'id' | 'label' | 'instruction' | 'sort_order'>[];
  tones: Pick<ToneRow, 'id' | 'label' | 'definition' | 'sort_order'>[];
};

/** What is kept on the phone, so the app has its prompts at once and without internet. */
export type CachedPrompts = {
  defaults: RemoteDefaults | null;
  userPrompts: UserPromptRow[];
};

/**
 * One tone the user can pick, after their own changes are applied.
 *
 * - default: one of Banter's tones, as Banter defines it.
 * - edited: one of Banter's tones with the user's own definition.
 * - custom: a tone the user made.
 */
export type Tone = {
  /** Stable while the tone exists: the default tone's id, or the custom tone's row id. */
  key: string;
  label: string;
  /** The text that goes into the prompt. */
  definition: string;
  kind: 'default' | 'edited' | 'custom';
  /** The default tone this is, or is a version of. Null for a custom tone. */
  toneId: string | null;
  /** The user's row behind an edited or custom tone. */
  userPromptId: string | null;
  /** Banter's own definition, to compare with or go back to. Null for a custom tone. */
  defaultDefinition: string | null;
};

/** Everything a prompt is built from, for this user, right now. */
export type ResolvedPrompts = {
  core: PromptCore;
  modes: Record<ModeId, { label: string; instruction: string }>;
  /** Banter's tones in their order, then the user's own, oldest first. */
  tones: Tone[];
  /** Where the defaults came from: Supabase, or the copy built into the app. */
  defaultsFrom: 'supabase' | 'app';
};

export const TONE_LABEL_MAX = 30;
export const TONE_DEFINITION_MAX = 600;
