import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';

export type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Each segment gets `<testIDPrefix>-<value>`. */
  testIDPrefix?: string;
};

/** A few options side by side, one of them chosen. For two to four short labels. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  testIDPrefix,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.surface, borderColor: colors.border }, disabled && styles.disabled]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            style={[styles.segment, selected && { backgroundColor: colors.accent }]}>
            <AppText variant="label" color={selected ? 'onAccent' : 'textMuted'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: spacing.xs, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
