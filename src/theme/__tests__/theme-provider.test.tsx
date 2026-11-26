import { render, screen, userEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { renderWithTheme } from '@/test-utils';
import { themes, useTheme } from '@/theme';

function Probe() {
  const { name, colors, setTheme } = useTheme();
  return (
    <>
      <Text testID="name">{name}</Text>
      <Text testID="accent">{colors.accent}</Text>
      <Pressable accessibilityRole="button" onPress={() => setTheme('ember')}>
        <Text>Use Ember</Text>
      </Pressable>
    </>
  );
}

describe('ThemeProvider', () => {
  it('starts on the default theme', async () => {
    await renderWithTheme(<Probe />);
    expect(screen.getByTestId('name')).toHaveTextContent('midnightPlum');
    expect(screen.getByTestId('accent')).toHaveTextContent(themes.midnightPlum.colors.accent);
  });

  it('starts on a restored theme when one is given', async () => {
    await renderWithTheme(<Probe />, { theme: 'deepSea' });
    expect(screen.getByTestId('name')).toHaveTextContent('deepSea');
  });

  it('switches theme and reports the choice so it can be saved', async () => {
    const onThemeChange = jest.fn();
    await renderWithTheme(<Probe />, { onThemeChange });

    await userEvent.setup().press(screen.getByRole('button', { name: 'Use Ember' }));

    expect(screen.getByTestId('name')).toHaveTextContent('ember');
    expect(screen.getByTestId('accent')).toHaveTextContent(themes.ember.colors.accent);
    expect(onThemeChange).toHaveBeenCalledTimes(1);
    expect(onThemeChange).toHaveBeenCalledWith('ember');
  });

  it('does not report a change when the active theme is picked again', async () => {
    const onThemeChange = jest.fn();
    await renderWithTheme(<Probe />, { theme: 'ember', onThemeChange });

    await userEvent.setup().press(screen.getByRole('button', { name: 'Use Ember' }));

    expect(onThemeChange).not.toHaveBeenCalled();
  });

  it('fails loudly when a component is used outside the provider', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow('useTheme must be used inside <ThemeProvider>');
    error.mockRestore();
  });
});
