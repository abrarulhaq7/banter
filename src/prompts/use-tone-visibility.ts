import { useState } from 'react';

import { useToast } from '@/components/ui';
import { useProfile } from '@/data';
import { profileSettings } from '@/data/settings';

import { usePrompts } from './prompts-provider';
import type { Tone } from './types';

export type ToneVisibility = {
  /** Keys of the tones hidden from the Generate screen. */
  hidden: ReadonlySet<string>;
  /** Every tone, in the user's order. */
  ordered: Tone[];
  /** The tones shown on the Generate screen, in the user's order. */
  shown: Tone[];
  /** Shows a hidden tone, or hides a shown one. The change shows at once and is saved. */
  toggle: (key: string) => void;
  /** Moves a tone one place up or down: the first ones show first on Generate. Saved too. */
  move: (key: string, direction: 'up' | 'down') => void;
};

/**
 * Tones in the user's order: the ones in `order` first, as listed, then any others (a tone
 * made since, or one Banter added) in their usual order.
 */
export function orderTones(tones: readonly Tone[], order: readonly string[]): Tone[] {
  const rank = (key: string) => {
    const at = order.indexOf(key);
    return at === -1 ? order.length : at;
  };
  return tones
    .map((tone, index) => ({ tone, index }))
    .sort((a, b) => rank(a.tone.key) - rank(b.tone.key) || a.index - b.index)
    .map(({ tone }) => tone);
}

/**
 * Which tones the Generate screen shows, and in what order. Kept in the profile's settings,
 * so the choice follows the user to another phone. A list of hidden tones, not shown ones: a
 * tone the user makes, or one Banter adds later, shows until they hide it.
 */
export function useToneVisibility(): ToneVisibility {
  const { profile, save } = useProfile();
  const { tones } = usePrompts();
  const toast = useToast();
  /** The latest choices, shown while they are being saved. Null: show what is saved. */
  const [pendingHidden, setPendingHidden] = useState<string[] | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);

  const settings = profileSettings(profile);
  const hiddenList = pendingHidden ?? settings.hidden_tones ?? [];
  const order = pendingOrder ?? settings.tone_order ?? [];
  const hidden = new Set(hiddenList);
  const ordered = orderTones(tones, order);

  // Both lists go into every save, so a quick hide and a quick move cannot undo each other.
  // A list the user never set stays out of the settings.
  const store = (next: { hidden_tones: string[]; tone_order: string[] }) => {
    setPendingHidden(next.hidden_tones);
    setPendingOrder(next.tone_order);
    const current = profileSettings(profile);
    const lists = {
      ...(next.hidden_tones.length > 0 || current.hidden_tones ? { hidden_tones: next.hidden_tones } : {}),
      ...(next.tone_order.length > 0 || current.tone_order ? { tone_order: next.tone_order } : {}),
    };
    void save({ settings: { ...current, ...lists } }).then((result) => {
      setPendingHidden(null);
      setPendingOrder(null);
      if (!result.ok) toast.show('Could not save that. Check your internet.', 'danger');
    });
  };

  const toggle = (key: string) => {
    const next = hidden.has(key) ? hiddenList.filter((item) => item !== key) : [...hiddenList, key];
    store({ hidden_tones: next, tone_order: order });
  };

  const move = (key: string, direction: 'up' | 'down') => {
    const keys = ordered.map((tone) => tone.key);
    const from = keys.indexOf(key);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= keys.length) return;
    [keys[from], keys[to]] = [keys[to], keys[from]];
    store({ hidden_tones: hiddenList, tone_order: keys });
  };

  return { hidden, ordered, shown: ordered.filter((tone) => !hidden.has(tone.key)), toggle, move };
}
