import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type * as ExpoUpdates from 'expo-updates';

/** The over-the-air update (EAS Update) the app runs instead of the code it was built with. */
export type AppUpdate = { id: string; createdAt: string | null; channel: string | null; runtimeVersion: string | null };

/** The app and the phone it runs on. */
export type AppInfo = {
  version: string;
  platform: string;
  os: string;
  device: string | null;
  /** Null when the app runs the code it was built with, and in a development build. */
  update: AppUpdate | null;
};

/** The parts of expo-updates read here. */
export type UpdatesState = Pick<
  typeof ExpoUpdates,
  'isEnabled' | 'isEmbeddedLaunch' | 'updateId' | 'createdAt' | 'channel' | 'runtimeVersion'
>;

/**
 * expo-updates, when this build has it. Its native part exists only in builds made after it
 * was added, and importing it in an older development build throws.
 */
function loadUpdates(): UpdatesState | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates') as UpdatesState;
  } catch {
    return null;
  }
}

/** The over-the-air update the app runs, or null when it runs the code it was built with. */
export function runningUpdate(updates: UpdatesState | null): AppUpdate | null {
  if (!updates?.isEnabled || updates.isEmbeddedLaunch || !updates.updateId) return null;
  return {
    id: updates.updateId,
    createdAt: updates.createdAt ? updates.createdAt.toISOString() : null,
    channel: updates.channel ?? null,
    runtimeVersion: updates.runtimeVersion ?? null,
  };
}

/** The app's version, the update it runs, and the phone it runs on, for a ticket. */
export function appInfo(updates: UpdatesState | null = loadUpdates()): AppInfo {
  // Android reports its version and model here; iOS reports its version.
  const constants = Platform.constants as { Release?: string; Model?: string; osVersion?: string };
  return {
    version: Constants.expoConfig?.version ?? 'unknown',
    platform: Platform.OS,
    os: String(constants.Release ?? constants.osVersion ?? Platform.Version),
    device: constants.Model ?? null,
    update: runningUpdate(updates),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** When an update was published, in the phone's time: "27 Nov, 14:05". */
export function updateTime(update: AppUpdate): string | null {
  const when = update.createdAt ? new Date(update.createdAt) : null;
  if (!when || Number.isNaN(when.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${when.getDate()} ${MONTHS[when.getMonth()]}, ${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

/** "Banter 0.1.0", or "Banter 0.1.0 · updated 27 Nov, 14:05" when it runs an update sent over the air. */
export function versionLabel(app: AppInfo): string {
  const base = `Banter ${app.version}`;
  if (!app.update) return base;
  const time = updateTime(app.update);
  return time ? `${base} · updated ${time}` : `${base} · updated`;
}
