import type { TextStyle } from 'react-native';

/** Spacing scale in points. Use these instead of raw numbers for padding, margin and gap. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Smallest comfortable touch target (Apple and Android guidelines). */
export const MIN_TOUCH_TARGET = 44;

/**
 * Font families are embedded at build time by the expo-font plugin in app.json.
 * A family plus a `fontWeight` selects the face on both platforms.
 */
export const fontFamily = {
  heading: 'Space Grotesk',
  body: 'Inter',
} as const;

export type TypeVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption';

export const typography: Record<TypeVariant, TextStyle> = {
  display: { fontFamily: fontFamily.heading, fontWeight: '700', fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fontFamily.heading, fontWeight: '700', fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fontFamily.heading, fontWeight: '500', fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.body, fontWeight: '400', fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fontFamily.body, fontWeight: '600', fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fontFamily.body, fontWeight: '500', fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fontFamily.body, fontWeight: '400', fontSize: 12, lineHeight: 16 },
};
