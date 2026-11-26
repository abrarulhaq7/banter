import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Icon } from './icon';

export type OptionListProps<T extends string> = {
  options: readonly { value: T; label: string; subtitle?: string }[];
  /** The chosen option, if any. */
  value: T | null;
  onSelect: (value: T) => void;
  disabled?: boolean;
  /** Each option gets `<testIDPrefix>-<value>`. */
  testIDPrefix?: string;
};

/** A short list to choose one from, with a tick on the chosen one. Made for sheets. */
export function OptionList<T extends string>({ options, value, onSelect, disabled, testIDPrefix }: OptionListProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.list}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
            onPress={() => onSelect(option.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled: Boolean(disabled) }}
            style={({ pressed }) => [
              styles.row,
              { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.background },
              pressed && { backgroundColor: colors.raised },
            ]}>
            <View style={styles.text}>
              <AppText variant="bodyStrong">{option.label}</AppText>
              {option.subtitle ? (
                <AppText variant="caption" color="textMuted">
                  {option.subtitle}
                </AppText>
              ) : null}
            </View>
            {selected ? <Icon name="check" size={18} color="accent" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  text: { flex: 1, gap: spacing.xxs },
});
