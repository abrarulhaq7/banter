import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';
import { FadeIn } from './fade-in';
import { Icon, type IconName } from './icon';

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  /** What will appear here, and how to make it appear. */
  message?: string;
  /** The one thing to do next. */
  action?: { label: string; onPress: () => void; icon?: IconName; testID?: string };
  testID?: string;
};

/** Shown where a list or a result will be, before there is anything to show. */
export function EmptyState({ icon, title, message, action, testID }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <FadeIn style={styles.base}>
      <View testID={testID} style={styles.inner}>
        <View style={[styles.circle, { backgroundColor: colors.accentSoft }]}>
          <Icon name={icon} size={30} color="accent" />
        </View>
        <AppText variant="heading" style={styles.center}>
          {title}
        </AppText>
        {message ? (
          <AppText color="textMuted" style={styles.center}>
            {message}
          </AppText>
        ) : null}
        {action ? (
          <Button
            testID={action.testID}
            variant="secondary"
            icon={action.icon}
            label={action.label}
            onPress={action.onPress}
            style={styles.action}
          />
        ) : null}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: spacing.xxl },
  inner: { alignItems: 'center', gap: spacing.sm },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  action: { marginTop: spacing.md, alignSelf: 'center', paddingHorizontal: spacing.xl },
});
