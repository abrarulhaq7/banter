import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET, radius, useTheme, type ColorRole } from '@/theme';

import { Icon, type IconName } from './icon';

export type IconButtonProps = {
  icon: IconName;
  /** What the button does, read by screen readers. There is no visible text. */
  label: string;
  onPress?: () => void;
  /** plain: just the icon. filled: on a raised circle. */
  variant?: 'plain' | 'filled';
  color?: ColorRole;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A button that is only an icon: back, close, copy, keep. */
export function IconButton({
  icon,
  label,
  onPress,
  variant = 'plain',
  color = 'text',
  selected,
  disabled = false,
  style,
  testID,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
      style={({ pressed }) => [
        styles.base,
        variant === 'filled' && { backgroundColor: colors.raised },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
});
