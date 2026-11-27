import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  AssetField,
  MediaSubtype,
  MediaType,
  Query,
  requestPermissionsAsync,
  type Asset,
} from 'expo-media-library';
import { Platform } from 'react-native';

import { fitWithin } from '@/engine';

import { SCREENSHOT_MESSAGES, type PreparedScreenshot, type ScreenshotResult } from './types';

export { SCREENSHOT_MESSAGES } from './types';
export type { PreparedScreenshot, ScreenshotFailure, ScreenshotResult } from './types';

const fail = (reason: keyof typeof SCREENSHOT_MESSAGES): ScreenshotResult => ({
  ok: false,
  reason,
  message: SCREENSHOT_MESSAGES[reason],
});

/**
 * Resizes to at most 1280 px on the longest side and converts to JPEG (PLAN.md section 5).
 * The same resized file is what gets shown, sent to the AI and, later, uploaded.
 */
export async function prepareImage(uri: string, width: number, height: number): Promise<PreparedScreenshot> {
  const context = ImageManipulator.manipulate(uri);
  const target = fitWithin(width, height);
  if (width > 0 && height > 0 && (target.width !== width || target.height !== height)) {
    context.resize(target);
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new Error('The resized image has no data.');

  return {
    previewUri: saved.uri,
    image: { base64: saved.base64, mediaType: 'image/jpeg' },
    width: saved.width,
    height: saved.height,
  };
}

/**
 * An image shared to Banter from another app (Android's share menu). It arrives without its
 * size, so it is rendered once to learn it, then prepared like any other screenshot.
 */
export async function prepareSharedImage(uri: string): Promise<ScreenshotResult> {
  try {
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    return { ok: true, screenshot: await prepareImage(uri, probe.width, probe.height) };
  } catch {
    return fail('failed');
  }
}

/** Opens the system photo picker. Needs no photo permission: the user hands over one image. */
export async function pickFromGallery(): Promise<ScreenshotResult> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || result.assets.length === 0) {
      return { ok: false, reason: 'cancelled', message: '' };
    }
    const [picked] = result.assets;
    return { ok: true, screenshot: await prepareImage(picked.uri, picked.width, picked.height) };
  } catch {
    return fail('failed');
  }
}

const newestFirst = { key: AssetField.CREATION_TIME, ascending: false } as const;

/** The newest screenshot in the library, or the newest image if nothing is marked as one. */
async function findNewest(): Promise<Asset | undefined> {
  if (Platform.OS === 'ios') {
    // iOS marks screenshots itself, in any language.
    const [screenshot] = await new Query()
      .contains(AssetField.MEDIA_SUBTYPES, MediaSubtype.SCREENSHOT)
      .orderBy(newestFirst)
      .limit(1)
      .exe();
    if (screenshot) return screenshot;
  }

  const recent = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy(newestFirst)
    .limit(Platform.OS === 'ios' ? 1 : 30)
    .exe();

  if (Platform.OS !== 'ios') {
    // Android has no screenshot mark. Its screenshots are files named "Screenshot_...".
    for (const asset of recent) {
      if (/screenshot/i.test(await asset.getFilename())) return asset;
    }
  }
  return recent[0];
}

/** Finds the newest screenshot. Asks for photo access the first time. */
export async function getLatestScreenshot(): Promise<ScreenshotResult> {
  try {
    const permission = await requestPermissionsAsync(false, ['photo']);
    if (permission.status !== 'granted') return fail('no_permission');
    // With "Limited access" iOS hides every photo the user did not hand-pick, so the
    // newest screenshot is usually invisible. Better to say so than to show an old one.
    if (permission.accessPrivileges === 'limited') return fail('limited_access');

    const asset = await findNewest();
    if (!asset) return fail('none_found');

    const [uri, width, height] = await Promise.all([asset.getUri(), asset.getWidth(), asset.getHeight()]);
    return { ok: true, screenshot: await prepareImage(uri, width, height) };
  } catch {
    return fail('failed');
  }
}
