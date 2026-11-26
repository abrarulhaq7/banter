import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Card,
  Chip,
  ChipRow,
  Icon,
  Screen,
  ScreenHeader,
  Sheet,
  useToast,
} from '@/components/ui';
import { DEFAULT_MODES, type ModeId } from '@/engine';
import { useHistory, type InteractionWithLines } from '@/history';
import { timeAgo } from '@/history/labels';
import type { LineResult, LineRow } from '@/lib/database.types';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';

import { SHOT_STATUS } from './shot-status';
import { usePersonHistory } from './use-person-history';

const ADJUSTMENT = { new_lines: 'New lines', shorter: 'Shorter', bolder: 'Bolder' } as const;
const modeLabel = (modeId: string) => DEFAULT_MODES[modeId as ModeId]?.label ?? modeId;

const chipLabel = (set: InteractionWithLines) =>
  [set.tone_label ?? modeLabel(set.mode_id), set.adjustment ? ADJUSTMENT[set.adjustment] : null].filter(Boolean).join(' · ');
const heading = (set: InteractionWithLines) =>
  [set.tone_label, modeLabel(set.mode_id), set.adjustment ? ADJUSTMENT[set.adjustment] : null].filter(Boolean).join(' · ');

type ShotScreenProps = {
  personId: string;
  /** Id of any set made from the screenshot. */
  shotId: string;
};

/**
 * One screenshot from someone's history: the lines written for it, which were used, how it
 * went. The screenshot is a thumbnail, so the lines are what the screen shows; a tap opens
 * it large.
 */
export function ShotScreen({ personId, shotId }: ShotScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast();
  const history = useHistory();
  const person = history.people.find((item) => item.id === personId);
  const { state, screenshots, reload } = usePersonHistory(personId);

  const [chosenSetId, setChosenSetId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  /** Results marked here, shown at once while the save goes through. */
  const [marked, setMarked] = useState<Record<string, LineResult | null>>({});

  const shot =
    state.status === 'ready' ? state.shots.find((item) => item.sets.some((set) => set.id === shotId)) : undefined;
  const shown = shot?.sets.find((set) => set.id === chosenSetId) ?? shot?.sets[0];
  const link = shot?.screenshotPath ? screenshots[shot.screenshotPath] : undefined;
  const analysis = (shown?.analysis ?? null) as { advice?: string; declined?: string } | null;

  const mark = (line: LineRow, result: LineResult) => {
    const current = line.id in marked ? marked[line.id] : line.result;
    // Tapping the chosen result again clears it.
    const next = current === result ? null : result;
    haptics.tap();
    toast.show(next ? 'Saved' : 'Cleared', 'info');
    setMarked((previous) => ({ ...previous, [line.id]: next }));
    void history.save({
      kind: 'linePatch',
      lineId: line.id,
      patch: { result: next, result_at: next ? new Date().toISOString() : null },
    });
  };

  // The status follows what is marked on this screen, before the save comes back.
  const results = shot?.sets.flatMap((set) => set.lines.map((line) => (line.id in marked ? marked[line.id] : line.result))) ?? [];
  const status = results.includes('replied')
    ? SHOT_STATUS.replied
    : results.includes('no_reply')
      ? SHOT_STATUS.no_reply
      : shot
        ? SHOT_STATUS[shot.status === 'unused' ? 'unused' : 'sent']
        : null;

  return (
    <Screen testID="shot-screen" contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} />

      <View style={styles.identity}>
        {link ? (
          <Pressable
            testID="shot-screenshot"
            onPress={() => setZoomed(true)}
            accessibilityRole="button"
            accessibilityLabel="Open the screenshot">
            <Image
              testID="shot-screenshot-image"
              source={{ uri: link }}
              resizeMode="cover"
              style={[styles.thumb, { backgroundColor: colors.surface, borderColor: colors.border }]}
            />
          </Pressable>
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="screenshot" size={22} color="textMuted" />
          </View>
        )}
        <View style={styles.fill}>
          <AppText testID="shot-title" variant="title" accessibilityRole="header" numberOfLines={1}>
            {person ? `@${person.username}` : 'Screenshot'}
          </AppText>
          {shot ? (
            <AppText variant="caption" color="textMuted">
              {timeAgo(shot.latestAt)}
            </AppText>
          ) : null}
          {status ? (
            <View style={styles.state}>
              <Icon name={status.icon} size={14} color={status.color} />
              <AppText testID="shot-status" variant="label" color={status.color}>
                {status.label}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      {state.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
      {state.status === 'error' ? (
        <Banner testID="timeline-error" tone="danger" action={{ label: 'Try again', onPress: reload }}>
          {state.message}
        </Banner>
      ) : null}
      {state.status === 'ready' && !shot ? (
        <AppText testID="shot-missing" color="textMuted">
          This screenshot is no longer in her history.
        </AppText>
      ) : null}

      {shot && shown ? (
        <>
          {shot.sets.length > 1 ? (
            <ChipRow testID="shot-set-chips">
              {shot.sets.map((set, index) => (
                <Chip
                  key={set.id}
                  testID={`shot-set-chip-${index}`}
                  label={chipLabel(set)}
                  selected={set.id === shown.id}
                  onPress={() => setChosenSetId(set.id)}
                />
              ))}
            </ChipRow>
          ) : null}

          <View style={styles.group}>
            <AppText testID="shot-heading" variant="heading" accessibilityRole="header">
              {heading(shown)}
            </AppText>
            {shown.noticed ? (
              <AppText variant="caption" color="textMuted" numberOfLines={2}>
                Noticed: {shown.noticed}
              </AppText>
            ) : null}
          </View>
          {analysis?.advice ? (
            <Card variant="raised">
              <AppText>{analysis.advice}</AppText>
            </Card>
          ) : null}
          {analysis?.declined ? (
            <Banner tone="warning" title="No lines for this one">
              {analysis.declined}
            </Banner>
          ) : null}

          {shown.lines.map((line, position) => {
            const result = line.id in marked ? marked[line.id] : line.result;
            const used = line.copied_at !== null;
            return (
              <Card key={line.id} testID={`shot-line-${position}`} selected={used}>
                <AppText>{line.text}</AppText>
                <View style={styles.state}>
                  {used ? <Icon name="check" size={14} color="success" /> : null}
                  <AppText testID={`shot-line-state-${position}`} variant="caption" color={used ? 'success' : 'textMuted'}>
                    {[used ? 'Copied' : 'Not used', line.kept_at ? 'Kept' : null].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                {used ? (
                  <View style={styles.chips}>
                    <Chip
                      testID={`replied-${position}`}
                      label="She replied"
                      selected={result === 'replied'}
                      onPress={() => mark(line, 'replied')}
                    />
                    <Chip
                      testID={`no-reply-${position}`}
                      label="No reply"
                      selected={result === 'no_reply'}
                      onPress={() => mark(line, 'no_reply')}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}

      <Sheet testID="shot-screenshot-sheet" visible={zoomed && !!link} title="Screenshot" onClose={() => setZoomed(false)}>
        <Image
          testID="shot-screenshot-large"
          source={{ uri: link }}
          resizeMode="contain"
          accessibilityLabel="The screenshot these lines were written for"
          style={[styles.large, { backgroundColor: colors.background }]}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  fill: { flex: 1, gap: spacing.xxs },
  thumb: { width: 60, height: 84, borderRadius: radius.md, borderWidth: 1 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  group: { gap: spacing.xs },
  state: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  large: { height: 440, borderRadius: radius.md },
});
