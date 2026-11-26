/**
 * The three Banter themes (PLAN.md section 11). All are dark.
 *
 * This file and tokens.ts are the only places where colour values may be written.
 * Everything else reads colours through `useTheme()`; the lint rule in
 * eslint.config.js enforces that.
 */

export type ThemeColors = {
  /** Screen background. */
  background: string;
  /** Cards and inputs. */
  surface: string;
  /** Active tab, secondary button, pressed states. */
  raised: string;
  border: string;
  text: string;
  textMuted: string;
  /** Selected chip, main button. */
  accent: string;
  /** Text and icons drawn on top of `accent`. */
  onAccent: string;
  /** Second accent, used for the "noticed" details. */
  accentAlt: string;
  /** Errors: wrong key, failed request, invalid input. */
  danger: string;
  /** Positive results: key accepted, "Replied". */
  success: string;
};

export type ColorRole = keyof ThemeColors;

export const THEME_NAMES = ['midnightPlum', 'ember', 'deepSea'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export type Theme = {
  name: ThemeName;
  /** Name shown to the user in the theme picker. */
  label: string;
  colors: ThemeColors;
};

export const DEFAULT_THEME: ThemeName = 'midnightPlum';

export const themes: Record<ThemeName, Theme> = {
  midnightPlum: {
    name: 'midnightPlum',
    label: 'Midnight Plum',
    colors: {
      background: '#120e1a',
      surface: '#1c1626',
      raised: '#2a2038',
      border: '#342a45',
      text: '#f2ecfa',
      textMuted: '#9c90b0',
      accent: '#b58cff',
      onAccent: '#1a1030',
      accentAlt: '#ff8fb1',
      danger: '#ff7a85',
      success: '#6fdca4',
    },
  },
  ember: {
    name: 'ember',
    label: 'Ember',
    colors: {
      background: '#141010',
      surface: '#1e1817',
      raised: '#2c2321',
      border: '#3a2e2b',
      text: '#f7eee8',
      textMuted: '#a59890',
      accent: '#ff7a59',
      onAccent: '#2a0f08',
      accentAlt: '#ffc46b',
      danger: '#ff6b7d',
      success: '#7fd99a',
    },
  },
  deepSea: {
    name: 'deepSea',
    label: 'Deep Sea',
    colors: {
      background: '#0a1316',
      surface: '#111e22',
      raised: '#1a2c32',
      border: '#24393f',
      text: '#e8f4f3',
      textMuted: '#86a0a3',
      accent: '#3ddbc4',
      onAccent: '#04231f',
      accentAlt: '#7fb2ff',
      danger: '#ff7f8a',
      success: '#8fe07f',
    },
  },
};

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value);
}
