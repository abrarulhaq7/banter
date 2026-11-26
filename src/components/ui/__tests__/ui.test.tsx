import { screen, userEvent } from '@testing-library/react-native';

import { AppText, Button, Card, Chip, Screen, TextField } from '@/components/ui';
import { renderWithTheme } from '@/test-utils';
import { themes, typography } from '@/theme';

const plum = themes.midnightPlum.colors;
const ember = themes.ember.colors;

describe('AppText', () => {
  it('uses the body style and the theme text colour by default', async () => {
    await renderWithTheme(<AppText>Hello</AppText>);
    expect(screen.getByText('Hello')).toHaveStyle({ ...typography.body, color: plum.text });
  });

  it('takes its colour from the active theme', async () => {
    await renderWithTheme(
      <AppText variant="caption" color="accentAlt">
        Noticed
      </AppText>,
      { theme: 'ember' },
    );
    expect(screen.getByText('Noticed')).toHaveStyle({
      ...typography.caption,
      color: ember.accentAlt,
    });
  });
});

describe('Button', () => {
  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="New lines" onPress={onPress} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'New lines' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fills the main button with the theme accent', async () => {
    await renderWithTheme(<Button label="Go" />, { theme: 'ember' });
    expect(screen.getByRole('button', { name: 'Go' })).toHaveStyle({
      backgroundColor: ember.accent,
    });
    expect(screen.getByText('Go')).toHaveStyle({ color: ember.onAccent });
  });

  it('ignores taps when disabled', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Save' });

    await userEvent.setup().press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the label and ignores taps while loading', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Save' });

    await userEvent.setup().press(button);

    expect(button).toBeBusy();
    expect(screen.queryByText('Save')).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('is marked selected and drawn in the accent colour when selected', async () => {
    await renderWithTheme(<Chip label="Flirty" selected />);
    const chip = screen.getByRole('button', { name: 'Flirty' });

    expect(chip).toBeSelected();
    expect(chip).toHaveStyle({ backgroundColor: plum.accent });
    expect(screen.getByText('Flirty')).toHaveStyle({ color: plum.onAccent });
  });

  it('is drawn on the surface colour when not selected', async () => {
    await renderWithTheme(<Chip label="Safe" />);
    const chip = screen.getByRole('button', { name: 'Safe' });

    expect(chip).not.toBeSelected();
    expect(chip).toHaveStyle({ backgroundColor: plum.surface, borderColor: plum.border });
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Chip label="Funny" onPress={onPress} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Funny' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Card', () => {
  it('is not a button when it has no onPress', async () => {
    await renderWithTheme(
      <Card testID="card">
        <AppText>Plain</AppText>
      </Card>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: plum.surface,
      borderColor: plum.border,
    });
  });

  it('is tappable and shows the accent border when selected', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Card onPress={onPress} selected accessibilityLabel="Line one">
        <AppText>Line one</AppText>
      </Card>,
    );
    const card = screen.getByRole('button', { name: 'Line one' });

    await userEvent.setup().press(card);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(card).toHaveStyle({ borderColor: plum.accent });
  });
});

describe('TextField', () => {
  it('shows the label and the helper text', async () => {
    await renderWithTheme(<TextField label="City" helper="Where you live" />);

    expect(screen.getByText('City')).toBeOnTheScreen();
    expect(screen.getByText('Where you live')).toHaveStyle({ color: plum.textMuted });
    expect(screen.getByLabelText('City')).toHaveStyle({ borderColor: plum.border });
  });

  it('shows the error instead of the helper, in the danger colour', async () => {
    await renderWithTheme(<TextField label="API key" helper="Paste it here" error="Wrong key" />);

    expect(screen.queryByText('Paste it here')).toBeNull();
    expect(screen.getByText('Wrong key')).toHaveStyle({ color: plum.danger });
    expect(screen.getByLabelText('API key')).toHaveStyle({ borderColor: plum.danger });
  });

  it('reports typed text', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(<TextField label="Name" onChangeText={onChangeText} />);

    await userEvent.setup().type(screen.getByLabelText('Name'), 'Sam');

    expect(onChangeText).toHaveBeenLastCalledWith('Sam');
  });
});

describe('Screen', () => {
  it('draws the theme background and shows its content', async () => {
    await renderWithTheme(
      <Screen testID="screen">
        <AppText>Inside</AppText>
      </Screen>,
      { theme: 'deepSea' },
    );

    expect(screen.getByText('Inside')).toBeOnTheScreen();
    expect(screen.getByTestId('screen')).toHaveStyle({
      backgroundColor: themes.deepSea.colors.background,
    });
  });

  it('shows its content without scrolling when scroll is off', async () => {
    await renderWithTheme(
      <Screen scroll={false}>
        <AppText>Fixed</AppText>
      </Screen>,
    );

    expect(screen.getByText('Fixed')).toBeOnTheScreen();
  });
});
