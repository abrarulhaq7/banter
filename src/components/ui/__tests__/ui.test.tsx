import { act, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';

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

describe('building blocks added for the tab-bar app', () => {
  // Imported here so the earlier tests in this file stay as they were.
  const ui = jest.requireActual<typeof import('@/components/ui')>('@/components/ui');
  const { Banner, Dialog, IconButton, ListRow, OptionList, SegmentedControl, Sheet, ToastProvider, useToast, ICON_NAMES, Icon } = ui;

  it('has an icon for every name', async () => {
    for (const name of ICON_NAMES) {
      const view = await renderWithTheme(<Icon name={name} testID="icon" />);
      // Icons are decoration: hidden from screen readers, so the lookup has to ask for hidden ones.
      expect(screen.getByTestId('icon', { includeHiddenElements: true })).toBeOnTheScreen();
      await view.unmount();
    }
  });

  it('IconButton is found by its label and can be pressed', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<IconButton icon="copy" label="Copy" onPress={onPress} />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Copy' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Banner uses the soft colour of its tone and runs its action', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Banner testID="banner" tone="warning" title="Add a key" action={{ label: 'Add', onPress }}>
        You need one.
      </Banner>,
    );
    expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: plum.warningSoft });
    expect(screen.getByText('Add a key')).toHaveStyle({ color: plum.warning });
    await userEvent.setup().press(screen.getByRole('button', { name: 'Add' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('a danger Banner announces its message', async () => {
    await renderWithTheme(<Banner tone="danger">It failed.</Banner>);
    expect(screen.getByRole('alert')).toHaveTextContent('It failed.');
  });

  it('ListRow reads as its title, value and subtitle, and is pressed as one button', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<ListRow icon="key" title="AI keys" subtitle="2 saved" value="Gemini" onPress={onPress} />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'AI keys, Gemini, 2 saved' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('SegmentedControl marks the chosen option and reports a new choice', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <SegmentedControl
        options={[
          { value: 'a', label: 'First' },
          { value: 'b', label: 'Second' },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'First' })).toBeSelected();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Second' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('OptionList marks the chosen option and reports a new choice', async () => {
    const onSelect = jest.fn();
    await renderWithTheme(
      <OptionList
        options={[
          { value: 'a', label: 'First' },
          { value: 'b', label: 'Second' },
        ]}
        value="b"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('button', { name: 'Second' })).toBeSelected();
    await userEvent.setup().press(screen.getByRole('button', { name: 'First' }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('Sheet shows its content only while open, and closes from the button or the backdrop', async () => {
    const onClose = jest.fn();
    function Opener() {
      const [visible, setVisible] = useState(false);
      return (
        <>
          <Button label="Open" onPress={() => setVisible(true)} />
          <Sheet visible={visible} title="Pick one" onClose={onClose}>
            <AppText>Inside</AppText>
          </Sheet>
        </>
      );
    }
    await renderWithTheme(<Opener />);
    expect(screen.queryByText('Inside')).toBeNull();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText('Inside')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Pick one' })).toBeOnTheScreen();

    await user.press(screen.getByTestId('sheet-close'));
    await user.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Dialog asks, and tells Cancel and Confirm apart', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderWithTheme(
      <Dialog visible tone="danger" title="Delete it?" message="This cannot be undone." confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(screen.getByText('This cannot be undone.')).toBeOnTheScreen();
    expect(screen.getByTestId('dialog-confirm')).toHaveStyle({ backgroundColor: plum.danger });

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Dialog blocks both buttons while busy', async () => {
    await renderWithTheme(<Dialog visible busy title="Sign out?" confirmLabel="Sign out" onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId('dialog-confirm')).toBeDisabled();
    expect(screen.getByTestId('dialog-cancel')).toBeDisabled();
  });

  it('a toast appears when asked for and goes away by itself', async () => {
    jest.useFakeTimers();
    try {
      function Asker() {
        const toast = useToast();
        return <Button label="Copy" onPress={() => toast.show('Copied')} />;
      }
      await renderWithTheme(
        <ToastProvider>
          <Asker />
        </ToastProvider>,
      );
      expect(screen.queryByTestId('toast')).toBeNull();

      await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole('button', { name: 'Copy' }));
      expect(screen.getByTestId('toast')).toHaveTextContent('Copied');

      await act(async () => {
        jest.advanceTimersByTime(ui.TOAST_MS + 50);
      });
      expect(screen.queryByTestId('toast')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('Screen pins a footer under the content', async () => {
    await renderWithTheme(
      <Screen fill footer={<Button label="Main action" />}>
        <AppText>Body</AppText>
      </Screen>,
    );
    expect(screen.getByText('Body')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Main action' })).toBeOnTheScreen();
  });

  it('Button can carry an icon and is still found by its label', async () => {
    await renderWithTheme(<Button icon="generate" label="Get lines" />);
    expect(screen.getByRole('button', { name: 'Get lines' })).toBeOnTheScreen();
  });

  it('Card has a raised and a tinted look', async () => {
    await renderWithTheme(
      <>
        <Card testID="raised" variant="raised">
          <AppText>a</AppText>
        </Card>
        <Card testID="tinted" variant="tinted">
          <AppText>b</AppText>
        </Card>
      </>,
    );
    expect(screen.getByTestId('raised')).toHaveStyle({ backgroundColor: plum.raised });
    expect(screen.getByTestId('tinted')).toHaveStyle({ backgroundColor: plum.accentSoft });
  });
});
