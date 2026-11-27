import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';

const CHIP_HEIGHT = 36;
const HIT_SLOP = { top: (MIN_TOUCH_TARGET - CHIP_HEIGHT) / 2, bottom: (MIN_TOUCH_TARGET - CHIP_HEIGHT) / 2 };

export type IconChipItem = {
  icon: IconName;
  /** What the button does, for screen readers: it has no text on screen. */
  label: string;
  onPress: () => void;
  testID?: string;
};

export type IconChipProps = {
  items: IconChipItem[];
  disabled?: boolean;
  testID?: string;
};

/**
 * One pill holding a few icon-only buttons, so tools beside a row of chips take little room
 * ("Tones" and "Help me pick" before the tones on Generate).
 */
export function IconChip({ items, disabled = false, testID }: IconChipProps) {
  const { colors } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: colors.surface, borderColor: colors.border },
        disabled && styles.disabled,
      ]}>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          <Pressable
            testID={item.testID}
            onPress={item.onPress}
            disabled={disabled}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ disabled }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Icon name={item.icon} size={18} color="accent" />
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: CHIP_HEIGHT,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  item: { height: '100%', paddingHorizontal: spacing.md, justifyContent: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 18 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
});
