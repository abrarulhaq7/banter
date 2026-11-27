import { Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

const HEIGHT = 36;

export type SettingChipProps = {
  icon: IconName;
  /** What the setting is: shown when nothing is chosen, and read out before the value. */
  label: string;
  /** What is chosen. Null shows the label instead, in a muted colour. */
  value?: string | null;
  /** warning: draws the icon in the warning colour (for turning up the heat). */
  tone?: 'accent' | 'warning';
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * A small pill for one setting of the request: who she is, how he knows her, where to take
 * it, the language. Several sit on one wrapped line instead of a row each.
 */
export function SettingChip({ icon, label, value, tone = 'accent', onPress, disabled = false, testID }: SettingChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={(MIN_TOUCH_TARGET - HEIGHT) / 2}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'not set'}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Icon name={icon} size={15} color={tone} />
      <AppText variant="label" color={value ? 'text' : 'textMuted'} numberOfLines={1}>
        {value ?? label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '100%',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
