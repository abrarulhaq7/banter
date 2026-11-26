import type { ProfileRow } from '@/lib/database.types';

import type { ProfilePatch } from './repos';

/** The "about you" form as the user types it: everything is text. */
export type ProfileFields = {
  name: string;
  age: string;
  city: string;
  work: string;
  interests: string;
  textingStyle: string;
};

export type ProfileErrors = Partial<Record<keyof ProfileFields, string>>;

/** Limits match the database's own checks (see supabase/migrations). */
const LIMITS: Record<keyof ProfileFields, number> = {
  name: 80,
  age: 3,
  city: 120,
  work: 200,
  interests: 1000,
  textingStyle: 2000,
};

export const MIN_AGE = 18;
const MAX_AGE = 120;

export function fieldsFromProfile(profile: ProfileRow | null): ProfileFields {
  return {
    name: profile?.display_name ?? '',
    age: profile?.age != null ? String(profile.age) : '',
    city: profile?.city ?? '',
    work: profile?.work ?? '',
    interests: profile?.interests ?? '',
    textingStyle: profile?.texting_style ?? '',
  };
}

export function validateProfile(fields: ProfileFields): ProfileErrors {
  const errors: ProfileErrors = {};

  if (!fields.name.trim()) errors.name = 'Enter your name.';

  const age = fields.age.trim();
  if (age) {
    if (!/^\d+$/.test(age)) errors.age = 'Enter your age as a number.';
    else if (Number(age) < MIN_AGE) errors.age = `Banter is for adults. You must be ${MIN_AGE} or older.`;
    else if (Number(age) > MAX_AGE) errors.age = 'Check your age.';
  }

  for (const field of Object.keys(LIMITS) as (keyof ProfileFields)[]) {
    if (!errors[field] && fields[field].trim().length > LIMITS[field]) {
      errors[field] = `Keep this under ${LIMITS[field]} characters.`;
    }
  }
  return errors;
}

/** What to save. Empty optional fields are stored as "not given" rather than as blanks. */
export function patchFromFields(fields: ProfileFields): ProfilePatch {
  const text = (value: string) => value.trim() || null;
  return {
    display_name: fields.name.trim(),
    age: fields.age.trim() ? Number(fields.age.trim()) : null,
    city: text(fields.city),
    work: text(fields.work),
    interests: text(fields.interests),
    texting_style: text(fields.textingStyle),
  };
}
