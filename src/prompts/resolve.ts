import { DEFAULT_CORE, DEFAULT_MODES, DEFAULT_TONES, type ModeId, type ToneId } from '@/engine';
import type { UserPromptRow } from '@/lib/database.types';

import { TONE_DEFINITION_MAX, TONE_LABEL_MAX, type RemoteDefaults, type ResolvedPrompts, type Tone } from './types';

const MODE_IDS = Object.keys(DEFAULT_MODES) as ModeId[];
const BUNDLED_TONES = (Object.keys(DEFAULT_TONES) as ToneId[]).map((id) => ({ id, ...DEFAULT_TONES[id] }));

/**
 * Supabase's defaults are used only when they are at least as new as the copy built into
 * the app, and complete. A newer build must not be pulled back to older rules because
 * the database has not been updated yet.
 */
function usable(remote: RemoteDefaults | null): remote is RemoteDefaults & { core: NonNullable<RemoteDefaults['core']> } {
  if (!remote?.core || remote.core.version < DEFAULT_CORE.version) return false;
  if (!remote.core.rules.trim() || !remote.core.output_format.trim()) return false;
  if (remote.tones.length === 0) return false;
  return MODE_IDS.every((id) => remote.modes.some((mode) => mode.id === id && mode.instruction.trim()));
}

/** Puts the layers together: Banter's defaults, then the user's own versions and tones. */
export function resolvePrompts(remote: RemoteDefaults | null, userPrompts: UserPromptRow[]): ResolvedPrompts {
  const fromSupabase = usable(remote);

  const core = fromSupabase
    ? { version: remote.core.version, rules: remote.core.rules, outputFormat: remote.core.output_format }
    : DEFAULT_CORE;

  const modes = { ...DEFAULT_MODES };
  if (fromSupabase) {
    for (const id of MODE_IDS) {
      const row = remote.modes.find((mode) => mode.id === id);
      if (row) modes[id] = { label: row.label, instruction: row.instruction };
    }
  }

  const defaults = fromSupabase
    ? [...remote.tones].sort((a, b) => a.sort_order - b.sort_order).map(({ id, label, definition }) => ({ id, label, definition }))
    : BUNDLED_TONES;

  const tones: Tone[] = defaults.map((tone) => {
    const own = userPrompts.find((row) => row.tone_id === tone.id);
    return {
      key: tone.id,
      label: tone.label,
      definition: own?.content ?? tone.definition,
      kind: own ? 'edited' : 'default',
      toneId: tone.id,
      userPromptId: own?.id ?? null,
      defaultDefinition: tone.definition,
    };
  });

  const custom = userPrompts
    .filter((row) => row.tone_id === null && row.mode_id === null && row.label)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const row of custom) {
    tones.push({
      key: row.id,
      label: row.label ?? '',
      definition: row.content,
      kind: 'custom',
      toneId: null,
      userPromptId: row.id,
      defaultDefinition: null,
    });
  }

  return { core, modes, tones, defaultsFrom: fromSupabase ? 'supabase' : 'app' };
}

/** The tone with this key, or the first one when it is gone (a custom tone was deleted). */
export function toneFor(tones: Tone[], key: string | null): Tone {
  return tones.find((tone) => tone.key === key) ?? tones[0];
}

/** A message when a tone's name cannot be saved, else null. */
export function toneLabelProblem(label: string, tones: Tone[], exceptKey?: string): string | null {
  const name = label.trim();
  if (!name) return 'Give the tone a name.';
  if (name.length > TONE_LABEL_MAX) return `Keep the name under ${TONE_LABEL_MAX} characters.`;
  const taken = tones.some((tone) => tone.key !== exceptKey && tone.label.toLowerCase() === name.toLowerCase());
  return taken ? 'You already have a tone with this name.' : null;
}

/** A message when a tone's definition cannot be saved, else null. */
export function toneDefinitionProblem(definition: string): string | null {
  const text = definition.trim();
  if (!text) return 'Describe how lines in this tone should sound.';
  if (text.length > TONE_DEFINITION_MAX) return `Keep this under ${TONE_DEFINITION_MAX} characters.`;
  return null;
}
