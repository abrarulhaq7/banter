import { Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

const CHIP_HEIGHT = 36;
const HIT_SLOP = (MIN_TOUCH_TARGET - CHIP_HEIGHT) / 2;

export type ChipProps = {
  label: string;
  /** Drawn before the label. */
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

/** A pill for picking one option from a row: mode, tone, context. */
export function Chip({ label, icon, selected = false, onPress, disabled = false, testID }: ChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? colors.accent : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {icon ? <Icon name={icon} size={16} color={selected ? 'onAccent' : 'accent'} /> : null}
      <AppText variant="label" color={selected ? 'onAccent' : 'text'} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: CHIP_HEIGHT,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
});
