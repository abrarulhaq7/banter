import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

type LineCardProps = {
  /** Used in test ids: `line-<testKey>`, `keep-<testKey>`, `line-status-<testKey>`. */
  testKey: string;
  text: string;
  /** Small line above the text: the detail it hooks to, or where a kept line came from. */
  caption?: string;
  copied: boolean;
  kept: boolean;
  onCopy: () => void;
  onToggleKeep: () => void;
};

/** One line to send. Tap the text to copy it; Keep pins it while other tones are tried. */
export function LineCard({ testKey, text, caption, copied, kept, onCopy, onToggleKeep }: LineCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: copied ? colors.accent : colors.border },
      ]}>
      <Pressable
        testID={`line-${testKey}`}
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityHint="Copies this line"
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
        {caption ? (
          <AppText variant="caption" color="accentAlt">
            {caption}
          </AppText>
        ) : null}
        <AppText>{text}</AppText>
      </Pressable>
      <View style={styles.footer}>
        <AppText testID={`line-status-${testKey}`} variant="caption" color={copied ? 'success' : 'textMuted'}>
          {copied ? 'Copied' : 'Tap to copy'}
        </AppText>
        <Button
          testID={`keep-${testKey}`}
          variant="ghost"
          size="sm"
          label={kept ? 'Kept' : 'Keep'}
          onPress={onToggleKeep}
          style={styles.keep}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  body: { gap: spacing.xs },
  pressed: { opacity: 0.6 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  keep: { paddingHorizontal: 0 },
});
