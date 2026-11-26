import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { IconButton } from './icon-button';

export type SheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
};

/**
 * A panel that slides up from the bottom for a small job: pick one of a few options,
 * edit one field. Tapping outside it, or the close button, puts it away.
 */
export function Sheet({ visible, title, subtitle, onClose, children, testID }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          testID="sheet-backdrop"
          accessibilityLabel="Close"
          onPress={onClose}
          style={[styles.fill, styles.backdrop, { backgroundColor: colors.scrim }]}
        />
        <View
          testID={testID}
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: spacing.xl + insets.bottom },
          ]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <View style={styles.titles}>
              <AppText variant="heading" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="caption" color="textMuted">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <IconButton testID="sheet-close" icon="close" label="Close" variant="filled" onPress={onClose} />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { opacity: 0.6 },
  panel: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.md,
    borderTopLeftRadius: radius.lg + spacing.sm,
    borderTopRightRadius: radius.lg + spacing.sm,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1, gap: spacing.xxs },
});
