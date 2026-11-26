import { screen, userEvent } from '@testing-library/react-native';

import { ThemePicker } from '@/components/theme-picker';
import { AppText } from '@/components/ui';
import { renderWithTheme } from '@/test-utils';
import { themes } from '@/theme';

describe('ThemePicker', () => {
  it('offers all three themes with the active one selected', async () => {
    await renderWithTheme(<ThemePicker />);

    expect(screen.getByRole('button', { name: 'Midnight Plum theme' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Ember theme' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Deep Sea theme' })).not.toBeSelected();
  });

  it('switches the colours of the rest of the app when a theme is tapped', async () => {
    const onThemeChange = jest.fn();
    await renderWithTheme(
      <>
        <ThemePicker />
        <AppText color="accent">Sample</AppText>
      </>,
      { onThemeChange },
    );
    expect(screen.getByText('Sample')).toHaveStyle({ color: themes.midnightPlum.colors.accent });

    await userEvent.setup().press(screen.getByRole('button', { name: 'Deep Sea theme' }));

    expect(screen.getByText('Sample')).toHaveStyle({ color: themes.deepSea.colors.accent });
    expect(screen.getByRole('button', { name: 'Deep Sea theme' })).toBeSelected();
    expect(onThemeChange).toHaveBeenCalledWith('deepSea');
  });
});
