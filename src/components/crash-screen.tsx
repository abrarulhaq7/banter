import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_THEME, fontFamily, radius, spacing, themes } from '@/theme';

/**
 * Shown instead of a screen that crashed, so one broken screen never takes the app down.
 *
 * It uses plain views and the default theme directly: when this is on screen the app's
 * own providers may be the thing that failed, so it must not depend on any of them.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const colors = themes[DEFAULT_THEME].colors;

  return (
    <View testID="crash-screen" style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        Something went wrong
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        This screen ran into a problem. Your account, keys and history are safe.
      </Text>
      <Pressable
        testID="crash-retry"
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={() => void retry()}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
        <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>Try again</Text>
      </Pressable>
      {__DEV__ ? (
        <Text testID="crash-detail" style={[styles.detail, { color: colors.danger }]}>
          {error.name}: {error.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  title: { fontFamily: fontFamily.heading, fontWeight: '700', fontSize: 24, lineHeight: 30 },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 23 },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonLabel: { fontFamily: fontFamily.body, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.75 },
  detail: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
});
