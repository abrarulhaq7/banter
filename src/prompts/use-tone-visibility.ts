import { useState } from 'react';

import { useToast } from '@/components/ui';
import { useProfile } from '@/data';
import { profileSettings } from '@/data/settings';

import { usePrompts } from './prompts-provider';
import type { Tone } from './types';

export type ToneVisibility = {
  /** Keys of the tones hidden from the Generate screen. */
  hidden: ReadonlySet<string>;
  /** The tones shown on the Generate screen, in their usual order. */
  shown: Tone[];
  /** Shows a hidden tone, or hides a shown one. The change shows at once and is saved. */
  toggle: (key: string) => void;
};

/**
 * Which tones the Generate screen shows. Kept in the profile's settings, so the choice
 * follows the user to another phone. A list of hidden tones, not shown ones: a tone the
 * user makes, or one Banter adds later, shows until they hide it.
 */
export function useToneVisibility(): ToneVisibility {
  const { profile, save } = useProfile();
  const { tones } = usePrompts();
  const toast = useToast();
  /** The latest choice, shown while it is being saved. Null: show what is saved. */
  const [pending, setPending] = useState<string[] | null>(null);

  const saved = profileSettings(profile).hidden_tones ?? [];
  const hiddenList = pending ?? saved;
  const hidden = new Set(hiddenList);

  const toggle = (key: string) => {
    const next = hidden.has(key) ? hiddenList.filter((item) => item !== key) : [...hiddenList, key];
    setPending(next);
    void save({ settings: { ...profileSettings(profile), hidden_tones: next } }).then((result) => {
      setPending(null);
      if (!result.ok) toast.show('Could not save that. Check your internet.', 'danger');
    });
  };

  return { hidden, shown: tones.filter((tone) => !hidden.has(tone.key)), toggle };
}
