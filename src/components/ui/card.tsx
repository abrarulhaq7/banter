import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme, type ColorRole } from '@/theme';

/** outlined: the default. raised: stands out a little. tinted: a soft colour, for emphasis. */
export type CardVariant = 'outlined' | 'raised' | 'tinted';

const SURFACE: Record<CardVariant, ColorRole> = { outlined: 'surface', raised: 'raised', tinted: 'accentSoft' };

export type CardProps = {
  children: ReactNode;
  /** Makes the whole card tappable, for example "tap a line to copy it". */
  onPress?: () => void;
  /** Read by screen readers when the card is tappable. */
  accessibilityLabel?: string;
  /** Draws the border in the accent colour, for the chosen item in a list. */
  selected?: boolean;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Card({
  children,
  onPress,
  accessibilityLabel,
  selected = false,
  variant = 'outlined',
  style,
  testID,
}: CardProps) {
  const { colors } = useTheme();
  const themed = {
    backgroundColor: colors[SURFACE[variant]],
    borderColor: selected ? colors.accent : variant === 'outlined' ? colors.border : colors[SURFACE[variant]],
  };

  if (!onPress) {
    return (
      <View testID={testID} style={[styles.base, themed, style]}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.base,
        themed,
        pressed && { backgroundColor: colors.raised },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
});
