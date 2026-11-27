import { isShareLink } from '@/generate/share-link';

/**
 * Where a link or a share that opens the app should go. An image shared to Banter from
 * another app opens Generate, which picks the image up. Everything else goes where it was going.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return isShareLink(path) ? '/' : path;
}
