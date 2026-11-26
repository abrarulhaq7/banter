import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme, type ColorRole } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';
import { Icon, type IconName } from './icon';

export type BannerTone = 'info' | 'warning' | 'success' | 'danger';

const TONES: Record<BannerTone, { color: ColorRole; soft: ColorRole; icon: IconName }> = {
  info: { color: 'info', soft: 'infoSoft', icon: 'info' },
  warning: { color: 'warning', soft: 'warningSoft', icon: 'warning' },
  success: { color: 'success', soft: 'successSoft', icon: 'success' },
  danger: { color: 'danger', soft: 'dangerSoft', icon: 'danger' },
};

export type BannerProps = {
  tone: BannerTone;
  title?: string;
  /** The message. Plain text, or anything else. */
  children?: ReactNode;
  /** One next step, as a text button under the message. */
  action?: { label: string; onPress: () => void; disabled?: boolean; testID?: string };
  /** Test id of the message text. */
  messageTestID?: string;
  testID?: string;
};

/** A coloured notice: something to know, to fix, or that went wrong. */
export function Banner({ tone, title, children, action, messageTestID, testID }: BannerProps) {
  const { colors } = useTheme();
  const look = TONES[tone];
  return (
    <View testID={testID} style={[styles.base, { backgroundColor: colors[look.soft] }]}>
      <View style={styles.icon}>
        <Icon name={look.icon} size={20} color={look.color} />
      </View>
      <View style={styles.body}>
        {title ? (
          <AppText variant="bodyStrong" color={look.color}>
            {title}
          </AppText>
        ) : null}
        {typeof children === 'string' ? (
          <AppText
            testID={messageTestID}
            variant="label"
            accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
            {children}
          </AppText>
        ) : (
          children
        )}
        {action ? (
          <Button
            testID={action.testID}
            variant="ghost"
            size="sm"
            label={action.label}
            onPress={action.onPress}
            disabled={action.disabled}
            style={styles.action}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  icon: { paddingTop: spacing.xxs },
  body: { flex: 1, gap: spacing.xs },
  action: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
