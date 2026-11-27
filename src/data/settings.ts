import type { ProfileRow, ProfileSettings } from '@/lib/database.types';

/** What the app keeps in the profile's settings, read safely from whatever is stored there. */
export function profileSettings(profile: ProfileRow | null): ProfileSettings {
  return (profile?.settings ?? {}) as ProfileSettings;
}

/** True unless the user turned off saving screenshots. */
export function savesScreenshots(profile: ProfileRow | null): boolean {
  return profileSettings(profile).save_screenshots !== false;
}
