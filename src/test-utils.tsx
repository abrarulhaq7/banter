import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider, type ThemeName } from '@/theme';

type Options = {
  theme?: ThemeName;
  onThemeChange?: (name: ThemeName) => void;
};

/** Renders a component inside the theme provider, the way every screen is rendered. */
export function renderWithTheme(element: ReactElement, { theme, onThemeChange }: Options = {}) {
  return render(
    <ThemeProvider initialTheme={theme} onThemeChange={onThemeChange}>
      {element}
    </ThemeProvider>,
  );
}
