import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, useTheme, type ColorRole } from '@/theme';

import { AppText } from './app-text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  /** primary: the main action. secondary: other actions. ghost: low-emphasis text button. */
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const CONTENT_COLOR: Record<ButtonVariant, ColorRole> = {
  primary: 'onAccent',
  secondary: 'text',
  ghost: 'accent',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const contentColor = CONTENT_COLOR[variant];

  const background: Record<ButtonVariant, string | undefined> = {
    primary: colors.accent,
    secondary: colors.raised,
    ghost: undefined,
  };

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: background[variant] },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors[contentColor]} />
      ) : (
        <AppText variant="bodyStrong" color={contentColor} numberOfLines={1}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
});
