import type { ComponentRef, ReactNode, RefObject } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

/** The scrolling area of a screen, as a ref sees it. */
export type ScrollHandle = ComponentRef<typeof ScrollView>;

export type ScreenProps = {
  children: ReactNode;
  /** Scrolls the content. Use for lists and forms. Default: true. */
  scroll?: boolean;
  /**
   * For a screen designed to fit without scrolling: the content fills the height, so a
   * child with `flex: 1` takes the room that is left. It still scrolls if it cannot fit
   * (a very small phone, very large text), so nothing is ever out of reach.
   */
  fill?: boolean;
  /** Stays pinned to the bottom, above the keyboard: the screen's main action. */
  footer?: ReactNode;
  /** Safe-area edges to pad. Screens inside a tab bar should leave out 'bottom'. */
  edges?: readonly Edge[];
  /** Style for the content area (inside the padding). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Gives a screen control of the scrolling, for example to bring new results into view. */
  scrollViewRef?: RefObject<ScrollHandle | null>;
  testID?: string;
};

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

/** The outer layout of every screen: theme background, safe area, padding, keyboard handling. */
export function Screen({
  children,
  scroll = true,
  fill = false,
  footer,
  edges = DEFAULT_EDGES,
  contentStyle,
  scrollViewRef,
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // A scrolling screen pads its content by the bottom inset instead of the frame, so the
  // content scrolls under the home indicator rather than being cut off above it.
  const scrollUnderBottom = scroll && !footer && edges.includes('bottom');
  const frameEdges = scrollUnderBottom ? edges.filter((edge) => edge !== 'bottom') : edges;

  return (
    <SafeAreaView
      testID={testID}
      edges={frameEdges}
      style={[styles.fill, { backgroundColor: colors.background }]}>
      {/* A behavior on both platforms: Expo apps draw edge to edge on Android, so the window no
          longer shrinks for the keyboard, and without one the keyboard covers fields and the footer. */}
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        {scroll ? (
          <ScrollView
            ref={scrollViewRef}
            style={styles.fill}
            contentContainerStyle={[
              styles.content,
              fill && styles.grow,
              scrollUnderBottom && { paddingBottom: spacing.xxl + insets.bottom },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            // Dragging the page puts the keyboard away, so it never traps a long form.
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, styles.content, contentStyle]}>{children}</View>
        )}
        {footer ? (
          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
});
