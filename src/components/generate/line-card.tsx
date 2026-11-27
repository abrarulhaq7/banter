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
  /** Why the user did not like the line, shown on the card. */
  feedbackLabel?: string | null;
  /** Opens the reasons. Left out where a line cannot be marked (the Kept sheet). */
  onDislike?: () => void;
  /** The user liked the line: more like this. */
  liked?: boolean;
  /** Likes the line, or takes the like back. Left out where a line cannot be marked. */
  onLike?: () => void;
  /** Opens the screenshot the line was written for (People > Saved). */
  onOpen?: () => void;
  /** Reports this one line (Results): the flag in the corner. Left out where it cannot be. */
  onReport?: () => void;
};

/** One line to send. Tap it, or the copy button, to copy; the bookmark keeps it. */
export function LineCard({
  testKey,
  text,
  caption,
  copied,
  kept,
  onCopy,
  onToggleKeep,
  feedbackLabel,
  onDislike,
  liked = false,
  onLike,
  onOpen,
  onReport,
}: LineCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: copied ? colors.accent : colors.border },
      ]}>
      <View style={styles.top}>
        <Pressable
          testID={`line-${testKey}`}
          onPress={onCopy}
          accessibilityRole="button"
          // The caption is inside the button, so it is part of what is read out (and of what
          // test tools can see): the line first, then what it hooks to or who it was for.
          accessibilityLabel={caption ? `${text}, ${caption}` : text}
          accessibilityHint="Copies this line"
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
          {caption ? (
            <AppText variant="caption" color="accentAlt" numberOfLines={1}>
              {caption}
            </AppText>
          ) : null}
          <AppText>{text}</AppText>
        </Pressable>
        {/* Beside the line, not inside it: a button within the copy button would be out of reach. */}
        {onReport ? (
          <IconButton
            testID={`report-${testKey}`}
            icon="report"
            label="Report this line"
            color="textMuted"
            onPress={onReport}
            style={styles.report}
          />
        ) : null}
      </View>
      <View style={styles.footer}>
        <View style={styles.status}>
          {copied ? <Icon name="check" size={14} color="success" /> : null}
          <AppText
            testID={`line-status-${testKey}`}
            variant="caption"
            color={copied ? 'success' : liked ? 'accent' : feedbackLabel ? 'danger' : 'textMuted'}>
            {copied ? 'Copied' : liked ? 'Liked' : feedbackLabel ? `Not for me: ${feedbackLabel}` : 'Tap to copy'}
          </AppText>
        </View>
        {onOpen ? (
          <IconButton testID={`open-${testKey}`} icon="open" label="Open where it came from" color="textMuted" onPress={onOpen} />
        ) : null}
        {onLike ? (
          <IconButton
            testID={`like-${testKey}`}
            icon={liked ? 'liked' : 'like'}
            label={liked ? 'Liked' : 'Like'}
            color={liked ? 'accent' : 'textMuted'}
            selected={liked}
            onPress={onLike}
          />
        ) : null}
        {onDislike ? (
          <IconButton
            testID={`dislike-${testKey}`}
            icon={feedbackLabel ? 'disliked' : 'dislike'}
            label={feedbackLabel ? `Not for me: ${feedbackLabel}` : 'Not for me'}
            color={feedbackLabel ? 'danger' : 'textMuted'}
            selected={Boolean(feedbackLabel)}
            onPress={onDislike}
          />
        ) : null}
        <IconButton testID={`copy-${testKey}`} icon="copy" label="Copy" color="textMuted" onPress={onCopy} />
        <IconButton
          testID={`keep-${testKey}`}
          icon={kept ? 'kept' : 'keep'}
          label={kept ? 'Remove from saved' : 'Save this line'}
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
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  body: { flex: 1, gap: spacing.xs, paddingRight: spacing.md },
  report: { marginTop: -spacing.sm },
  pressed: { opacity: 0.6 },
  footer: { flexDirection: 'row', alignItems: 'center' },
  status: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
