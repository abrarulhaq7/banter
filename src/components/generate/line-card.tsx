import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, IconButton } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

type LineCardProps = {
  /** Used in test ids: `line-<testKey>`, `copy-<testKey>`, `keep-<testKey>`, `line-status-<testKey>`. */
  testKey: string;
  text: string;
  /** Small line above the text: the detail it hooks to, or where a kept line came from. */
  caption?: string;
  copied: boolean;
  kept: boolean;
  onCopy: () => void;
  onToggleKeep: () => void;
};

/** One line to send. Tap it, or the copy button, to copy; the bookmark keeps it. */
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
          <AppText variant="caption" color="accentAlt" numberOfLines={1}>
            {caption}
          </AppText>
        ) : null}
        <AppText>{text}</AppText>
      </Pressable>
      <View style={styles.footer}>
        <View style={styles.status}>
          {copied ? <Icon name="check" size={14} color="success" /> : null}
          <AppText testID={`line-status-${testKey}`} variant="caption" color={copied ? 'success' : 'textMuted'}>
            {copied ? 'Copied' : 'Tap to copy'}
          </AppText>
        </View>
        <IconButton testID={`copy-${testKey}`} icon="copy" label="Copy" color="textMuted" onPress={onCopy} />
        <IconButton
          testID={`keep-${testKey}`}
          icon={kept ? 'kept' : 'keep'}
          label={kept ? 'Kept' : 'Keep'}
          color={kept ? 'accent' : 'textMuted'}
          selected={kept}
          onPress={onToggleKeep}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, paddingLeft: spacing.lg, paddingRight: spacing.xs, paddingTop: spacing.md },
  body: { gap: spacing.xs, paddingRight: spacing.md },
  pressed: { opacity: 0.6 },
  footer: { flexDirection: 'row', alignItems: 'center' },
  status: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
