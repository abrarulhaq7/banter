import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  /** Scrolls the content. Use for forms and long pages. Default: true. */
  scroll?: boolean;
  /** Safe-area edges to pad. Screens inside a tab bar should leave out 'bottom'. */
  edges?: readonly Edge[];
  /** Style for the content area (inside the padding). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

/** The outer layout of every screen: theme background, safe area, padding, keyboard handling. */
export function Screen({
  children,
  scroll = true,
  edges = DEFAULT_EDGES,
  contentStyle,
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // A scrolling screen pads its content by the bottom inset instead of the frame, so the
  // content scrolls under the home indicator rather than being cut off above it.
  const scrollUnderBottom = scroll && edges.includes('bottom');
  const frameEdges = scrollUnderBottom ? edges.filter((edge) => edge !== 'bottom') : edges;

  return (
    <SafeAreaView
      testID={testID}
      edges={frameEdges}
      style={[styles.fill, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[
              styles.content,
              scrollUnderBottom && { paddingBottom: spacing.xxl + insets.bottom },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, styles.content, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
});
