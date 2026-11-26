import type { ImageInput } from '@/engine';

/** A screenshot resized and ready: `image` goes to the AI, `previewUri` is shown on screen. */
export type PreparedScreenshot = {
  previewUri: string;
  image: ImageInput;
  width: number;
  height: number;
};

export type ScreenshotFailure =
  /** The user closed the picker without choosing. Not an error. */
  | 'cancelled'
  /** Photo access was refused. */
  | 'no_permission'
  /** Only some photos are shared with the app, so the newest screenshot may be hidden. */
  | 'limited_access'
  /** The photo library has no images. */
  | 'none_found'
  | 'failed';

export type ScreenshotResult =
  | { ok: true; screenshot: PreparedScreenshot }
  | { ok: false; reason: ScreenshotFailure; message: string };

export const SCREENSHOT_MESSAGES: Record<Exclude<ScreenshotFailure, 'cancelled'>, string> = {
  no_permission:
    'Banter cannot see your photos. Allow photo access in Settings, or use "Pick from gallery".',
  limited_access:
    'Banter can only see the photos you selected, so it cannot find your newest screenshot. Use "Pick from gallery", or allow full photo access in Settings.',
  none_found: 'No photos found. Take a screenshot in Instagram first.',
  failed: 'Could not open that image. Try another one.',
};
