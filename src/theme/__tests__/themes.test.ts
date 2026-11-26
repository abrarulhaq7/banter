import { DEFAULT_THEME, THEME_NAMES, isThemeName, themes, type ColorRole } from '@/theme';

/** WCAG 2.x relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG AA for normal-size text. */
const AA_TEXT = 4.5;

/** Every [text colour, background colour] pair the components actually draw. */
const TEXT_PAIRS: [ColorRole, ColorRole][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'raised'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['onAccent', 'accent'],
  ['accent', 'background'],
  ['accentAlt', 'surface'],
  ['danger', 'background'],
  ['danger', 'surface'],
  ['success', 'surface'],
];

describe('themes', () => {
  it('uses Midnight Plum as the default', () => {
    expect(DEFAULT_THEME).toBe('midnightPlum');
    expect(themes[DEFAULT_THEME].label).toBe('Midnight Plum');
  });

  it('defines the same colour roles in every theme', () => {
    const roles = Object.keys(themes[DEFAULT_THEME].colors).sort();
    for (const name of THEME_NAMES) {
      expect(Object.keys(themes[name].colors).sort()).toEqual(roles);
      expect(themes[name].name).toBe(name);
    }
  });

  it('writes every colour as a six-digit hex value', () => {
    for (const name of THEME_NAMES) {
      for (const value of Object.values(themes[name].colors)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  describe.each(THEME_NAMES)('%s', (name) => {
    const { colors } = themes[name];

    it.each(TEXT_PAIRS)('%s on %s is readable', (foreground, background) => {
      expect(contrast(colors[foreground], colors[background])).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  it('recognises saved theme names and rejects anything else', () => {
    expect(isThemeName('ember')).toBe(true);
    expect(isThemeName('light')).toBe(false);
    expect(isThemeName(undefined)).toBe(false);
  });
});
