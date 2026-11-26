import { Modal, StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';
import { Icon, type IconName } from './icon';

export type DialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger: for deleting and signing out. The confirm button and icon turn red. */
  tone?: 'default' | 'danger';
  icon?: IconName;
  /** Shows a spinner on the confirm button and blocks both buttons. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Asks before doing something that cannot be undone, or that the user may not have meant. */
export function Dialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  icon,
  busy = false,
  onConfirm,
  onCancel,
}: DialogProps) {
  const { colors } = useTheme();
  const danger = tone === 'danger';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.center}>
        <View style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: colors.scrim }]} />
        <View testID="dialog" accessibilityViewIsModal style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: danger ? colors.dangerSoft : colors.accentSoft }]}>
            <Icon name={icon ?? (danger ? 'warning' : 'info')} size={24} color={danger ? 'danger' : 'accent'} />
          </View>
          <AppText variant="heading" accessibilityRole="header" style={styles.centerText}>
            {title}
          </AppText>
          {message ? (
            <AppText variant="label" color="textMuted" style={styles.centerText}>
              {message}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button testID="dialog-cancel" style={styles.fill} variant="secondary" label={cancelLabel} onPress={onCancel} disabled={busy} />
            <Button
              testID="dialog-confirm"
              style={[styles.fill, danger && { backgroundColor: colors.danger }]}
              label={confirmLabel}
              onPress={onConfirm}
              loading={busy}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  backdrop: { opacity: 0.6 },
  box: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.xl,
    gap: spacing.md,
    borderRadius: radius.lg + spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignSelf: 'stretch' },
  fill: { flex: 1 },
});
