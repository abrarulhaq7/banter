import { createContext, use, useState, type ReactNode } from 'react';

import { DEFAULT_THEME, themes, type Theme, type ThemeName } from './themes';

type ThemeContextValue = Theme & {
  setTheme: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
  /** Theme to start with, for example one restored from the phone's cache. */
  initialTheme?: ThemeName;
  /** Called after the user picks a theme, so the choice can be saved. */
  onThemeChange?: (name: ThemeName) => void;
};

export function ThemeProvider({
  children,
  initialTheme = DEFAULT_THEME,
  onThemeChange,
}: ThemeProviderProps) {
  const [name, setName] = useState<ThemeName>(initialTheme);

  const setTheme = (next: ThemeName) => {
    if (next === name) return;
    setName(next);
    onThemeChange?.(next);
  };

  return <ThemeContext value={{ ...themes[name], setTheme }}>{children}</ThemeContext>;
}

/** The active theme: `colors`, `name`, `label`, and `setTheme` to switch. */
export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return value;
}
