import type { IconName, TextFieldProps } from '@/components/ui';
import type { ProfileFields } from '@/data';

export type ProfileFieldId = keyof ProfileFields;

type FieldSpec = {
  /** Short name, for a row. */
  title: string;
  /** The label above the input. */
  label: string;
  icon: IconName;
  testID: string;
  input: Pick<
    TextFieldProps,
    'placeholder' | 'helper' | 'autoCapitalize' | 'keyboardType' | 'maxLength' | 'multiline' | 'textContentType' | 'autoComplete'
  >;
};

/** The "about you" facts: how each is named, drawn and typed. Shared by onboarding and Settings. */
export const PROFILE_FIELDS: Record<ProfileFieldId, FieldSpec> = {
  name: {
    title: 'Name',
    label: 'Name',
    icon: 'person',
    testID: 'profile-name',
    input: { placeholder: 'What people call you', autoCapitalize: 'words', textContentType: 'none', autoComplete: 'off' },
  },
  age: {
    title: 'Age',
    label: 'Age (optional)',
    icon: 'age',
    testID: 'profile-age',
    input: { placeholder: '18 or older', keyboardType: 'number-pad', maxLength: 3 },
  },
  city: {
    title: 'City',
    label: 'City (optional)',
    icon: 'city',
    testID: 'profile-city',
    input: { placeholder: 'Where you live', autoCapitalize: 'words' },
  },
  work: {
    title: 'Work or study',
    label: 'Work or study (optional)',
    icon: 'work',
    testID: 'profile-work',
    input: { placeholder: 'What you do' },
  },
  interests: {
    title: 'Interests',
    label: 'Interests (optional)',
    icon: 'interests',
    testID: 'profile-interests',
    input: { placeholder: 'Football, cooking, old films, hiking', multiline: true },
  },
  textingStyle: {
    title: 'How you text',
    label: 'How you text (optional)',
    icon: 'texting',
    testID: 'profile-texting-style',
    input: {
      placeholder: 'Short, lowercase, a bit dry, few emoji',
      helper: 'In your own words. Banter uses this to make lines sound like you.',
      multiline: true,
    },
  },
};

/**
 * What the user wants from Banter. Kept with the profile's settings, not in a column of its
 * own, and edited on About you only. It reaches the line prompts and Tune my tones.
 */
export const GOAL_FIELD: FieldSpec = {
  title: 'What you want from Banter',
  label: 'What you want from Banter',
  icon: 'generate',
  testID: 'profile-goal',
  input: {
    placeholder:
      'Who you message, what you want to happen, how you want to come across. The more you say, the better your tones fit.',
    multiline: true,
    maxLength: 1000,
  },
};

/** Onboarding asks for the facts first, then for how the user sounds. */
export const FACT_FIELDS: readonly ProfileFieldId[] = ['name', 'age', 'city', 'work'];
export const VOICE_FIELDS: readonly ProfileFieldId[] = ['interests', 'textingStyle'];
export const ALL_FIELDS: readonly ProfileFieldId[] = [...FACT_FIELDS, ...VOICE_FIELDS];
