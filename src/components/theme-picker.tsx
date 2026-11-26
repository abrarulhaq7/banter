import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { THEME_NAMES, radius, spacing, themes, useTheme, type ThemeName } from '@/theme';

/** Three preview cards, one per theme. Tap one to switch the whole app to it. */
export function ThemePicker() {
  const { name: active, setTheme } = useTheme();

  return (
    <View style={styles.row}>
      {THEME_NAMES.map((name) => (
        <ThemePreview
          key={name}
          name={name}
          selected={name === active}
          onPress={() => setTheme(name)}
        />
      ))}
    </View>
  );
}

type ThemePreviewProps = {
  name: ThemeName;
  selected: boolean;
  onPress: () => void;
};

/** Each preview is drawn in its own theme's colours, not the active theme's. */
function ThemePreview({ name, selected, onPress }: ThemePreviewProps) {
  const { colors: activeColors } = useTheme();
  const { label, colors } = themes[name];

  return (
    <Pressable
      testID={`theme-${name}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} theme`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View
        style={[
          styles.swatch,
          {
            backgroundColor: colors.background,
            borderColor: selected ? activeColors.accent : activeColors.border,
          },
          selected && styles.swatchSelected,
        ]}>
        <View style={[styles.swatchCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.swatchLine, { backgroundColor: colors.text }]} />
          <View style={[styles.swatchLineShort, { backgroundColor: colors.accentAlt }]} />
        </View>
        <View style={[styles.swatchButton, { backgroundColor: colors.accent }]} />
      </View>
      <AppText variant="caption" color={selected ? 'text' : 'textMuted'} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  item: { flex: 1, alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.75 },
  swatch: {
    alignSelf: 'stretch',
    height: 96,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  swatchSelected: { borderWidth: 2 },
  swatchCard: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  swatchLine: { height: 4, borderRadius: radius.pill, opacity: 0.85 },
  swatchLineShort: { height: 4, width: '55%', borderRadius: radius.pill },
  swatchButton: { height: 14, borderRadius: radius.sm },
});
