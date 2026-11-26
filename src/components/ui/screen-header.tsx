import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './app-text';
import { IconButton } from './icon-button';

export type ScreenHeaderProps = {
  /** Left out on screens that show their own heading under the bar. */
  title?: string;
  subtitle?: string;
  /** Shows a Back button above the title. */
  onBack?: () => void;
  /** Buttons at the top right. */
  right?: ReactNode;
  /** Test id of the title text. */
  titleTestID?: string;
};

/** The title block at the top of a screen. */
export function ScreenHeader({ title, subtitle, onBack, right, titleTestID }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {onBack || right ? (
        <View style={styles.bar}>
          {onBack ? (
            <IconButton testID="back-button" icon="back" label="Back" variant="filled" onPress={onBack} />
          ) : (
            <View />
          )}
          {right}
        </View>
      ) : null}
      {title ? (
        <AppText testID={titleTestID} variant="title" accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      {subtitle ? <AppText color="textMuted">{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
});
