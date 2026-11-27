import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  BarButton,
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Icon,
  IconButton,
  Screen,
  OptionList,
  Sheet,
  TextField,
  useToast,
} from '@/components/ui';
import type { Adjustment, LineFeedback } from '@/engine';
import { useGenerateSession } from '@/generate/generate-provider';
import { ToneSheet } from '@/components/tones/tone-sheet';
import { adjustableLines, setChipLabel, type KeptLine } from '@/generate/session';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';

import { LineCard } from './line-card';
import { FEEDBACK_LABEL, ResultSetView } from './result-set-view';

/** The button that fixes a line, by why it was marked. */
const FIX_BUTTON: Record<LineFeedback, string> = {
  too_much: 'Get softer lines',
  too_tame: 'Get bolder lines',
  cringe: 'Get less cringe lines',
  not_me: 'Get lines more like me',
  too_long: 'Get shorter lines',
  generic: 'Get more specific lines',
};

const FEEDBACK_OPTIONS = (Object.keys(FEEDBACK_LABEL) as LineFeedback[]).map((reason) => ({
  value: reason,
  label: FEEDBACK_LABEL[reason][0].toUpperCase() + FEEDBACK_LABEL[reason].slice(1),
}));


/**
 * The lines for the current screenshot, one set at a time. Earlier sets are never
 * replaced: the chips at the top switch between them. The actions are pinned to the bottom.
 */
export function ResultsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast();
  const session = useGenerateSession();

  // The set being looked at. A choice only holds until a newer set arrives; then the
  // newest is shown again.
  const [choice, setChoice] = useState<{ setId: string; newest: string } | null>(null);
  const [sheet, setSheet] = useState<'tone' | 'username' | 'kept' | 'feedback' | null>(null);
  /** The line the "Not for me" sheet is about. */
  const [feedbackLine, setFeedbackLine] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  const newest = session.sets[0];
  const shown =
    (choice && choice.newest === newest?.id ? session.sets.find((set) => set.id === choice.setId) : undefined) ?? newest;
  const busy = session.phase !== 'idle';
  const keptIds = new Set(session.kept.map((line) => line.id));
  const canAdjust = adjustableLines(shown) !== null;
  const hasTone = shown ? shown.mode !== 'analyse' : false;

  const report = (arrived: boolean) => (arrived ? haptics.success() : haptics.error());
  const adjust = async (kind: Adjustment) => report(await session.adjust(kind, shown?.id));
  const anotherTone = async (tone: string) => {
    setSheet(null);
    report(await session.generate(tone));
  };

  const copy = (lineId: string, text: string) => {
    haptics.tap();
    toast.show('Copied');
    void session.copyLine(lineId, text);
  };
  const toggleKeep = (line: KeptLine) => {
    haptics.tap();
    toast.show(keptIds.has(line.id) ? 'Removed from saved' : 'Saved', 'info');
    session.toggleKeep(line);
  };

  const openUsername = () => {
    setDraft(session.username ?? '');
    setDraftError(null);
    setSheet('username');
  };
  const saveUsername = () => {
    const problem = session.setUsername(draft);
    if (problem) {
      setDraftError(problem);
      return;
    }
    setSheet(null);
    toast.show('Saved');
  };

  const errorAction = (() => {
    switch (session.error?.kind) {
      case 'no_keys':
        return { label: 'Add a key', onPress: () => router.push('/keys/add') };
      case 'wrong_key':
      case 'limit':
      case 'no_credit':
        return { label: 'Manage keys', onPress: () => router.push('/keys') };
      case 'screenshot':
      case undefined:
        return null;
      default:
        return { label: 'Try again', onPress: async () => report(await session.retry()) };
    }
  })();

  const errorBanner = session.error && session.error.kind !== 'screenshot' ? (
    <Banner
      testID="generate-error"
      tone="danger"
      messageTestID="generate-error-message"
      action={errorAction ? { ...errorAction, testID: 'generate-error-action', disabled: busy } : undefined}>
      {session.error.message}
    </Banner>
  ) : null;

  // Before the first set: waiting for it, or it failed, or (opened by a link) nothing was asked.
  if (!shown) {
    return (
      <Screen testID="results-screen" scroll={false} contentStyle={styles.emptyScreen}>
        <IconButton testID="back-button" icon="back" label="Back" variant="filled" onPress={() => router.back()} />
        {session.phase === 'generating' ? (
          <View testID="results-loading" style={styles.emptyBody}>
            {session.screenshot ? (
              <Image
                source={{ uri: session.screenshot.previewUri }}
                resizeMode="cover"
                accessibilityLabel="The screenshot being read"
                style={[styles.waitingShot, { borderColor: colors.border, backgroundColor: colors.surface }]}
              />
            ) : null}
            <ActivityIndicator color={colors.accent} />
            <AppText variant="bodyStrong">Reading the screenshot…</AppText>
            <AppText variant="caption" color="textMuted" style={styles.centerText}>
              This usually takes a few seconds.
            </AppText>
          </View>
        ) : errorBanner ? (
          <View style={styles.emptyError}>{errorBanner}</View>
        ) : (
          <View style={styles.emptyBody}>
            <EmptyState
              testID="results-empty"
              icon="generate"
              title="No lines yet"
              message="Choose a screenshot and tap Get lines."
            />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      testID="results-screen"
      contentStyle={styles.content}
      footer={
        <>
          {session.phase === 'generating' ? (
            <View testID="generating" style={styles.working}>
              <ActivityIndicator color={colors.accent} />
              <AppText variant="label" color="textMuted">
                Writing lines…
              </AppText>
            </View>
          ) : null}
          <View style={styles.bar}>
            {hasTone ? (
              <BarButton testID="another-tone" icon="tone" label="Tone" onPress={() => setSheet('tone')} disabled={busy} />
            ) : (
              <BarButton
                testID="analyse-again"
                icon="newLines"
                label="Again"
                onPress={async () => report(await session.generate())}
                disabled={busy}
              />
            )}
            {canAdjust ? (
              <>
                <BarButton testID="adjust-new_lines" icon="newLines" label="New lines" onPress={() => adjust('new_lines')} disabled={busy} />
                <BarButton testID="adjust-shorter" icon="shorter" label="Shorter" onPress={() => adjust('shorter')} disabled={busy} />
                <BarButton testID="adjust-bolder" icon="bolder" label="Bolder" onPress={() => adjust('bolder')} disabled={busy} />
              </>
            ) : null}
          </View>
        </>
      }>
      {/* Who and what these lines are for. */}
      <View style={styles.top}>
        <IconButton testID="back-button" icon="back" label="Back" variant="filled" onPress={() => router.back()} />
        {session.screenshot ? (
          <Image
            source={{ uri: session.screenshot.previewUri }}
            resizeMode="cover"
            accessibilityLabel="The screenshot these lines are for"
            style={[styles.thumb, { borderColor: colors.border, backgroundColor: colors.surface }]}
          />
        ) : null}
        <View testID="person-row" style={styles.person}>
          <AppText variant="caption" color="textMuted">
            Saved under
          </AppText>
          <AppText testID="person-username" variant="bodyStrong" numberOfLines={1}>
            {session.username ? `@${session.username}` : 'No username read'}
          </AppText>
        </View>
        <IconButton
          testID="person-change"
          icon="edit"
          label={session.username ? 'Change username' : 'Add username'}
          onPress={openUsername}
        />
        {session.kept.length > 0 ? (
          <Pressable
            testID="kept-button"
            onPress={() => setSheet('kept')}
            accessibilityRole="button"
            accessibilityLabel={`Saved lines: ${session.kept.length}`}
            style={[styles.keptButton, { backgroundColor: colors.accentSoft }]}>
            <Icon name="kept" size={16} color="accent" />
            <AppText variant="label" color="accent">
              {session.kept.length}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {session.sets.length > 1 ? (
        <ChipRow testID="set-chips">
          {session.sets.map((set, index) => (
            <Chip
              key={set.id}
              testID={`set-chip-${index}`}
              label={setChipLabel(set)}
              selected={set.id === shown.id}
              onPress={() => newest && setChoice({ setId: set.id, newest: newest.id })}
            />
          ))}
        </ChipRow>
      ) : null}

      {errorBanner}

      <ResultSetView
        set={shown}
        copiedLineId={session.copiedLineId}
        keptIds={keptIds}
        onCopy={copy}
        onToggleKeep={toggleKeep}
        feedback={session.feedback}
        onDislike={(lineId) => {
          setFeedbackLine(lineId);
          setSheet('feedback');
        }}
      />

      <Sheet
        testID="feedback-sheet"
        visible={sheet === 'feedback'}
        title="Not for me"
        subtitle="Why? Banter steers away from it in the next lines."
        onClose={() => setSheet(null)}>
        <OptionList
          testIDPrefix="feedback"
          options={FEEDBACK_OPTIONS}
          value={feedbackLine ? (session.feedback[feedbackLine] ?? null) : null}
          onSelect={(reason) => {
            // Saved at once. The sheet stays, offering to fix the set for that reason.
            if (feedbackLine) session.setFeedback(feedbackLine, reason);
          }}
        />
        {feedbackLine && session.feedback[feedbackLine] ? (
          <>
            <Button
              testID="feedback-fix"
              icon="newLines"
              label={FIX_BUTTON[session.feedback[feedbackLine]]}
              onPress={() => {
                const lineId = feedbackLine;
                setSheet(null);
                void session.fixLine(lineId).then(report);
              }}
              disabled={busy}
            />
            <View style={styles.sheetActions}>
              <Button
                testID="feedback-clear"
                style={styles.fill}
                variant="ghost"
                label="Take it back"
                onPress={() => {
                  session.setFeedback(feedbackLine, null);
                  setSheet(null);
                }}
              />
              <Button
                testID="feedback-done"
                style={styles.fill}
                variant="secondary"
                label="Just note it"
                onPress={() => {
                  setSheet(null);
                  toast.show('Noted', 'info');
                }}
              />
            </View>
          </>
        ) : null}
      </Sheet>

      <ToneSheet
        testID="tone-sheet"
        visible={sheet === 'tone'}
        title="Another tone"
        subtitle="Writes a new set for this screenshot. The sets you have stay."
        onSelect={anotherTone}
        onClose={() => setSheet(null)}
      />

      <Sheet
        testID="person-edit"
        visible={sheet === 'username'}
        title="Who is this?"
        subtitle="Banter saves these lines under her Instagram username, and remembers them next time."
        onClose={() => setSheet(null)}>
        <TextField
          testID="person-input"
          label="Her Instagram username"
          placeholder="username"
          value={draft}
          onChangeText={setDraft}
          error={draftError ?? undefined}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          maxLength={31}
          returnKeyType="done"
          onSubmitEditing={saveUsername}
        />
        <View style={styles.sheetActions}>
          <Button testID="person-cancel" style={styles.fill} variant="secondary" label="Cancel" onPress={() => setSheet(null)} />
          <Button testID="person-save" style={styles.fill} label="Save" onPress={saveUsername} />
        </View>
      </Sheet>

      <Sheet
        testID="kept-strip"
        visible={sheet === 'kept' && session.kept.length > 0}
        title="Saved lines"
        subtitle="They stay here while you try other tones, and all of them are under People > Saved."
        onClose={() => setSheet(null)}>
        {session.kept.map((line, position) => (
          <LineCard
            key={line.id}
            testKey={`kept-${position}`}
            text={line.text}
            caption={line.label}
            copied={session.copiedLineId === `kept:${line.id}`}
            kept
            onCopy={() => copy(`kept:${line.id}`, line.text)}
            onToggleKeep={() => toggleKeep(line)}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: { width: 36, height: 48, borderRadius: radius.sm, borderWidth: 1 },
  person: { flex: 1, gap: spacing.xxs },
  keptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  working: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  bar: { flexDirection: 'row', gap: spacing.sm },
  sheetActions: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
  emptyScreen: { gap: spacing.lg },
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyError: { flex: 1, justifyContent: 'center' },
  waitingShot: { width: 120, height: 180, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.md },
  centerText: { textAlign: 'center' },
});
