import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme, type ColorRole } from '@/theme';

import { AppText } from './app-text';
import { FadeIn } from './fade-in';
import { Icon, type IconName } from './icon';

export type ToastTone = 'success' | 'info' | 'danger';

type Toast = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const LOOK: Record<ToastTone, { color: ColorRole; icon: IconName }> = {
  success: { color: 'success', icon: 'success' },
  info: { color: 'info', icon: 'info' },
  danger: { color: 'danger', icon: 'danger' },
};

/** How long a toast stays. Long enough to read three words, short enough not to be in the way. */
export const TOAST_MS = 1800;

/**
 * Shows short confirmations ("Copied") at the top of the screen, above everything. The top,
 * because the bottom is where the pinned buttons are, and a toast must not cover those.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const [value] = useState<ToastContextValue>(() => ({
    show(message, tone = 'success') {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: nextId.current++, message, tone });
      timer.current = setTimeout(() => setToast(null), TOAST_MS);
    },
  }));

  return (
    <ToastContext value={value}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={[styles.layer, { top: insets.top + spacing.sm }]}>
          {/* Keyed by the toast, so each new one fades in, even right after another. */}
          <FadeIn key={toast.id}>
            <View
              testID="toast"
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={[styles.toast, { backgroundColor: colors.raised, borderColor: colors.border }]}>
              <Icon name={LOOK[toast.tone].icon} size={18} color={LOOK[toast.tone].color} />
              <AppText variant="label">{toast.message}</AppText>
            </View>
          </FadeIn>
        </View>
      ) : null}
    </ToastContext>
  );
}

const SILENT: ToastContextValue = { show: () => {} };

/** `show("Copied")`. Outside a ToastProvider (a unit test of one component) it does nothing. */
export function useToast(): ToastContextValue {
  return use(ToastContext) ?? SILENT;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
