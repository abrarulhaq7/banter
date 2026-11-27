import { useState } from 'react';

import { useToast } from '@/components/ui';
import { useProfile } from '@/data';
import { profileSettings } from '@/data/settings';
import { cleanFocus } from '@/engine';

/** What "Focus on" offers before the user adds or removes a pill of their own. */
export const DEFAULT_FOCUS_PILLS = [
  'her hair',
  'her nails',
  'her dress',
  'her outfit',
  'the food',
  'the place',
  'the music',
  'her pet',
];

/** How many pills the user can keep. */
export const FOCUS_PILLS_MAX = 20;

export type FocusPills = {
  pills: string[];
  /** Adds a pill at the front, unless it is blank or already there. The change shows at once and is saved. */
  add: (text: string) => void;
  remove: (pill: string) => void;
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The pills offered for "Focus on", for picking what the lines are about in one tap. Kept in
 * the profile's settings, so they follow the user to another phone. Banter's defaults until
 * the user adds one of their own or removes one.
 */
export function useFocusPills(): FocusPills {
  const { profile, save } = useProfile();
  const toast = useToast();
  /** The latest list, shown while it is being saved. Null: show what is saved. */
  const [pending, setPending] = useState<string[] | null>(null);

  const pills = pending ?? profileSettings(profile).focus_pills ?? DEFAULT_FOCUS_PILLS;

  const store = (next: string[]) => {
    setPending(next);
    void save({ settings: { ...profileSettings(profile), focus_pills: next } }).then((result) => {
      setPending(null);
      if (!result.ok) toast.show('Could not save that. Check your internet.', 'danger');
    });
  };

  return {
    pills,
    add: (text) => {
      const pill = cleanFocus(text);
      if (!pill || pills.some((item) => same(item, pill))) return;
      store([pill, ...pills].slice(0, FOCUS_PILLS_MAX));
    },
    remove: (pill) => store(pills.filter((item) => !same(item, pill))),
  };
}
