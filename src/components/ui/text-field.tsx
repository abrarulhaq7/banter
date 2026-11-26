import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './app-text';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  /** Shown under the field in the danger colour, and replaces `helper`. */
  error?: string;
  /** A short hint shown under the field. */
  helper?: string;
};

export function TextField({
  label,
  error,
  helper,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;
  const message = error ?? helper;

  return (
    <View style={styles.container}>
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <TextInput
        {...rest}
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
          { color: colors.text, backgroundColor: colors.surface, borderColor },
        ]}
      />
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
});
