/**
 * Whether a link that opened the app is an image shared to Banter from another app
 * (Android's share menu). expo-sharing sends those as "expo-sharing" links.
 */
export function isShareLink(path: string): boolean {
  try {
    return new URL(path).hostname === 'expo-sharing';
  } catch {
    // Not a full URL: only a plain "expo-sharing" path counts.
    return /^\/?expo-sharing(\/|\?|$)/.test(path);
  }
}
