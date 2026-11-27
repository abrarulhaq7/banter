import type { ProfileRow, ProfileSettings } from '@/lib/database.types';

/** What the app keeps in the profile's settings, read safely from whatever is stored there. */
export function profileSettings(profile: ProfileRow | null): ProfileSettings {
  return (profile?.settings ?? {}) as ProfileSettings;
}

/** What the user wants from Banter, or null when they have not said. */
export function profileGoal(profile: ProfileRow | null): string | null {
  return profileSettings(profile).goal?.trim() || null;
}

/** The language the user wants lines in. English unless they chose otherwise. */
export function replyLanguage(profile: ProfileRow | null): 'english' | 'roman_urdu' {
  return profileSettings(profile).reply_language === 'roman_urdu' ? 'roman_urdu' : 'english';
}

/** True unless the user turned off saving screenshots. */
export function savesScreenshots(profile: ProfileRow | null): boolean {
  return profileSettings(profile).save_screenshots !== false;
}
