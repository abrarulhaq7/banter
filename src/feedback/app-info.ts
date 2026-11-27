import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { AppInfo } from './ticket';

/** The app's version and the phone it runs on, for a ticket. */
export function appInfo(): AppInfo {
  // Android reports its version and model here; iOS reports its version.
  const constants = Platform.constants as { Release?: string; Model?: string; osVersion?: string };
  return {
    version: Constants.expoConfig?.version ?? 'unknown',
    platform: Platform.OS,
    os: String(constants.Release ?? constants.osVersion ?? Platform.Version),
    device: constants.Model ?? null,
  };
}
