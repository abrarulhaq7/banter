import { Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

export type BarButtonProps = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

/** An icon with a short label under it, for a row of actions pinned to the bottom. */
export function BarButton({ icon, label, onPress, disabled = false, testID }: BarButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { backgroundColor: colors.raised },
        disabled && styles.disabled,
      ]}>
      <Icon name={icon} size={20} color="accent" />
      <AppText variant="caption" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  disabled: { opacity: 0.4 },
});
