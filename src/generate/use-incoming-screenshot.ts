import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** The part of expo-sharing's `useIncomingShare` this app reads. */
export type IncomingShare = {
  resolvedSharedPayloads: { contentType?: string | null; contentUri?: string | null }[];
  clearSharedPayloads: () => void;
};

const NOTHING_SHARED: IncomingShare = { resolvedSharedPayloads: [], clearSharedPayloads: () => {} };
const useNothingShared = () => NOTHING_SHARED;

/**
 * expo-sharing's hook, on Android only. Its native part exists only in builds made after it
 * was added, and importing it in an older build crashes; receiving shares is Android only
 * for now (an iOS share extension needs the paid Apple account).
 */
function sharingHook(): () => IncomingShare {
  if (Platform.OS !== 'android') return useNothingShared;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharing = require('expo-sharing') as { useIncomingShare: () => IncomingShare };
    return sharing.useIncomingShare;
  } catch {
    return useNothingShared;
  }
}

/**
 * Hands an image shared to Banter (Android's share menu: Instagram, Photos…) to `open`, once,
 * when the screen is ready for a new screenshot. Until then it waits, so a share that arrives
 * while lines are being written is not lost.
 */
export function createIncomingScreenshotHook(useShare: () => IncomingShare) {
  return function useIncomingScreenshot(open: (uri: string) => Promise<void> | void, ready: boolean) {
    const { resolvedSharedPayloads, clearSharedPayloads } = useShare();
    const uri = resolvedSharedPayloads.find(
      (payload) => payload.contentType === 'image' && payload.contentUri,
    )?.contentUri;
    const handled = useRef<string | null>(null);

    useEffect(() => {
      if (!uri || !ready || handled.current === uri) return;
      handled.current = uri;
      // The shared file is a copy in the app's cache that clearing deletes (seen on Android
      // 2026-11-27: "could not open that image"). Preparing it makes Banter's own copy, so
      // clear only once that is done.
      void Promise.resolve(open(uri)).finally(clearSharedPayloads);
    }, [uri, ready, open, clearSharedPayloads]);
  };
}

export const useIncomingScreenshot = createIncomingScreenshotHook(sharingHook());
