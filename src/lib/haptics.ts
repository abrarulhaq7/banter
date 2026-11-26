import * as Haptics from 'expo-haptics';

/**
 * Small vibrations that confirm an action. They are a nicety: a phone that cannot
 * vibrate, or has it turned off, must never cause an error.
 */
function quietly(run: () => Promise<void>) {
  try {
    void run().catch(() => {});
  } catch {
    // Not available here (a simulator, a test, an old phone).
  }
}

export const haptics = {
  /** A light tap: copied, kept, picked. */
  tap: () => quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Something finished well: lines arrived, saved. */
  success: () => quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Something went wrong. */
  error: () => quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
