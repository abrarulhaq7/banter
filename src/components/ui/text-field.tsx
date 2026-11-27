import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './app-text';
import { IconButton } from './icon-button';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  /** Shown under the field in the danger colour, and replaces `helper`. */
  error?: string;
  /** A short hint shown under the field. */
  helper?: string;
};

/**
 * A labelled text input. A password field (`secureTextEntry`) gets an eye button that
 * shows what was typed, and hides it again: typos in a hidden password are easy to make.
 */
export function TextField({
  label,
  error,
  helper,
  multiline,
  onFocus,
  onBlur,
  secureTextEntry,
  testID,
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;
  const message = error ?? helper;

  return (
    <View style={styles.container}>
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <View>
        <TextInput
          {...rest}
          testID={testID}
          secureTextEntry={secureTextEntry && !revealed}
          multiline={multiline}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          keyboardAppearance="dark"
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            multiline && styles.multiline,
            secureTextEntry && styles.roomForEye,
            { color: colors.text, backgroundColor: colors.surface, borderColor },
          ]}
        />
        {secureTextEntry ? (
          <View style={styles.eye}>
            <IconButton
              testID={testID ? `${testID}-visibility` : undefined}
              icon={revealed ? 'hidden' : 'shown'}
              label={revealed ? 'Hide password' : 'Show password'}
              color="textMuted"
              onPress={() => setRevealed((shown) => !shown)}
            />
          </View>
        ) : null}
      </View>
      {message ? (
        <AppText variant="caption" color={error ? 'danger' : 'textMuted'}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  input: {
    ...typography.body,
    // A fixed lineHeight clips single-line text on iOS, so let the input size itself.
    lineHeight: undefined,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  roomForEye: { paddingRight: spacing.lg + MIN_TOUCH_TARGET },
  eye: {
    position: 'absolute',
    right: spacing.xs,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
