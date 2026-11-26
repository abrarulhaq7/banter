import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Shows a Back button above the title. */
  onBack?: () => void;
};

/** The title block at the top of a screen. */
export function ScreenHeader({ title, subtitle, onBack }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {onBack ? (
        <Button testID="back-button" variant="ghost" size="sm" label="Back" onPress={onBack} style={styles.back} />
      ) : null}
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? <AppText color="textMuted">{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  back: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
