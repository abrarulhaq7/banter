import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/theme';

/** One line of chips that scrolls sideways, however many there are. */
export function ChipRow({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Reaches the screen edges, so chips slide out of view instead of being cut mid-air.
      style={styles.bleed}
      contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -spacing.xl, flexGrow: 0 },
  content: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: 'center' },
});
