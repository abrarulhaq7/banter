import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme, type ColorRole } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Keeps the subtitle on one line, shortened in the middle: for an email or a long id. */
  subtitleOneLine?: boolean;
  /** An icon in a soft circle on the left. */
  icon?: IconName;
  /** Colour of the icon and its circle. Default: accent. */
  tone?: 'accent' | 'info' | 'warning' | 'success' | 'danger';
  /** Replaces the icon: an avatar, a thumbnail. */
  leading?: ReactNode;
  /** Short text on the right, before the arrow: the current choice. */
  value?: string;
  /** Replaces the arrow on the right. */
  trailing?: ReactNode;
  /**
   * Buttons on the right that are tapped on their own, apart from the row: move up, move
   * down. They sit beside the tappable part, so each keeps its own label and test id.
   */
  actions?: ReactNode;
  onPress?: () => void;
  /** Shows a spinner on the right and blocks presses: the row's own action is running. */
  busy?: boolean;
  disabled?: boolean;
  /** Read by screen readers. Default: the title and subtitle. */
  accessibilityLabel?: string;
  titleTestID?: string;
  subtitleTestID?: string;
  testID?: string;
};

const SOFT: Record<NonNullable<ListRowProps['tone']>, ColorRole> = {
  accent: 'accentSoft',
  info: 'infoSoft',
  warning: 'warningSoft',
  success: 'successSoft',
  danger: 'dangerSoft',
};

/** One row of a list or menu: what it is on the left, where it leads on the right. */
export function ListRow({
  title,
  subtitle,
  subtitleOneLine = false,
  icon,
  tone = 'accent',
  leading,
  value,
  trailing,
  actions,
  onPress,
  busy = false,
  disabled = false,
  accessibilityLabel,
  titleTestID,
  subtitleTestID,
  testID,
}: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      {leading ??
        (icon ? (
          <View style={[styles.iconCircle, { backgroundColor: colors[SOFT[tone]] }]}>
            <Icon name={icon} size={18} color={tone} />
          </View>
        ) : null)}
      <View style={styles.text}>
        <AppText testID={titleTestID} variant="bodyStrong" color={tone === 'danger' ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            testID={subtitleTestID}
            variant="caption"
            color="textMuted"
            numberOfLines={subtitleOneLine ? 1 : 2}
            ellipsizeMode={subtitleOneLine ? 'middle' : 'tail'}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="label" color="textMuted" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        (trailing ?? (onPress && !actions ? <Icon name="forward" size={14} color="textMuted" /> : null))
      )}
    </>
  );

  const frame = [styles.base, { backgroundColor: colors.surface, borderColor: colors.border }];
  if (!onPress) {
    return (
      <View testID={testID} style={frame}>
        {content}
        {actions}
      </View>
    );
  }

  const inactive = disabled || busy;
  const press = {
    testID,
    onPress,
    disabled: inactive,
    accessibilityRole: 'button' as const,
    accessibilityLabel: accessibilityLabel ?? [title, value, subtitle].filter(Boolean).join(', '),
    accessibilityState: { disabled: inactive, busy },
  };
  if (actions) {
    return (
      <View style={[frame, disabled && styles.disabled]}>
        <Pressable {...press} style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
          {content}
        </Pressable>
        {actions}
      </View>
    );
  }
  return (
    <Pressable
      {...press}
      style={({ pressed }) => [frame, pressed && { backgroundColor: colors.raised }, disabled && styles.disabled]}>
      {content}
    </Pressable>
  );
}

/** A circle with someone's initial. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const initial = (name.replace(/[^a-z0-9]/gi, '')[0] ?? '?').toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft },
      ]}>
      <AppText variant={size >= 56 ? 'title' : 'bodyStrong'} color="accent">
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: spacing.xxs },
  value: { maxWidth: '40%' },
});
