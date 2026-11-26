import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, Screen, type ScrollHandle } from '@/components/ui';
import { DEFAULT_MODES, DEFAULT_TONES, type ContextId, type ModeId, type ToneId } from '@/engine';
import { adjustableLines } from '@/generate/session';
import { useGenerate, type GenerateDeps } from '@/generate/use-generate';
import { radius, spacing, useTheme } from '@/theme';

import { LineCard } from './line-card';
import { PersonRow } from './person-row';
import { ResultSetView } from './result-set-view';

const MODES = Object.keys(DEFAULT_MODES) as ModeId[];
const TONES = Object.keys(DEFAULT_TONES) as ToneId[];
const CONTEXTS: { id: ContextId; label: string }[] = [
  { id: 'stranger', label: 'Stranger' },
  { id: 'mutual_follow', label: 'Mutual follow' },
  { id: 'know_her', label: 'Know her' },
  { id: 'already_talking', label: 'Already talking' },
];

type GenerateScreenProps = {
  /** Tests replace the photo library, the AI call and the clipboard. */
  deps?: Partial<GenerateDeps>;
};

/** Home: pick a screenshot, choose mode and tone, get lines. */
export function GenerateScreen({ deps }: GenerateScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const session = useGenerate(deps);

  // After a generation the new lines, or the error, are below the fold. Bring them into view.
  const scrollRef = useRef<ScrollHandle>(null);
  const resultsTop = useRef(0);
  const newestSetId = session.sets[0]?.id;
  const errorMessage = session.error?.message;
  useEffect(() => {
    if (newestSetId || errorMessage) {
      scrollRef.current?.scrollTo({ y: Math.max(0, resultsTop.current - spacing.sm), animated: true });
    }
  }, [newestSetId, errorMessage]);

  const busy = session.phase !== 'idle';
  const isAnalyse = session.mode === 'analyse';
  const keptIds = new Set(session.kept.map((line) => line.id));
  const canAdjust = adjustableLines(session.sets[0]) !== null;

  const errorAction = (() => {
    switch (session.error?.kind) {
      case 'no_keys':
        return { label: 'Add a key', run: () => router.push('/keys/add') };
      case 'wrong_key':
      case 'limit':
      case 'no_credit':
        return { label: 'Manage keys', run: () => router.push('/keys') };
      case 'screenshot':
        return { label: 'Pick from gallery', run: session.pickScreenshot };
      case undefined:
        return null;
      default:
        return { label: 'Try again', run: session.generate };
    }
  })();

  return (
    <Screen testID="generate-screen" scrollViewRef={scrollRef}>
      <View style={styles.titleRow}>
        <AppText variant="display" accessibilityRole="header">
          Banter
        </AppText>
        <View style={styles.titleLinks}>
          <Button
            testID="open-people"
            variant="ghost"
            size="sm"
            label="People"
            style={styles.titleLink}
            onPress={() => router.push('/people')}
          />
          <Button
            testID="open-settings"
            variant="ghost"
            size="sm"
            label="Settings"
            style={styles.titleLink}
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>

      {!session.hasUsableKey ? (
        <Card testID="no-key-notice">
          <AppText variant="label" color="accentAlt">
            Add an AI key to start
          </AppText>
          <AppText variant="caption" color="textMuted">
            Banter writes lines with your own key from Gemini, OpenAI or Claude.
          </AppText>
          <Button
            testID="no-key-add"
            variant="ghost"
            size="sm"
            label="Add a key"
            style={styles.inlineAction}
            onPress={() => router.push('/keys/add')}
          />
        </Card>
      ) : null}

      <View style={styles.group}>
        {session.screenshot ? (
          <Image
            testID="screenshot-preview"
            source={{ uri: session.screenshot.previewUri }}
            resizeMode="contain"
            accessibilityLabel="The screenshot you chose"
            style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}
          />
        ) : (
          <AppText color="textMuted">
            Take a screenshot in Instagram of her story, profile or chat, then choose it here.
          </AppText>
        )}
        {/* Full labels need the full width before a screenshot is chosen; after that the
            two buttons share a row with shorter labels. */}
        <View style={session.screenshot ? styles.buttonRow : styles.group}>
          <Button
            testID="use-latest"
            style={session.screenshot ? styles.fill : undefined}
            variant={session.screenshot ? 'secondary' : 'primary'}
            label={session.screenshot ? 'Use newest' : 'Use latest screenshot'}
            onPress={session.useLatestScreenshot}
            loading={session.phase === 'loadingScreenshot'}
            disabled={busy}
          />
          <Button
            testID="pick-gallery"
            style={session.screenshot ? styles.fill : undefined}
            variant="secondary"
            label={session.screenshot ? 'Pick another' : 'Pick from gallery'}
            onPress={session.pickScreenshot}
            disabled={busy}
          />
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="label" color="textMuted">
          Mode
        </AppText>
        <View style={styles.chips}>
          {MODES.map((mode) => (
            <Chip
              key={mode}
              testID={`mode-${mode}`}
              label={DEFAULT_MODES[mode].label}
              selected={mode === session.mode}
              onPress={() => session.setMode(mode)}
              disabled={busy}
            />
          ))}
        </View>
      </View>

      {!isAnalyse ? (
        <View style={styles.group}>
          <AppText variant="label" color="textMuted">
            Tone
          </AppText>
          <View style={styles.chips}>
            {TONES.map((tone) => (
              <Chip
                key={tone}
                testID={`tone-${tone}`}
                label={DEFAULT_TONES[tone].label}
                selected={tone === session.tone}
                onPress={() => session.setTone(tone)}
                disabled={busy}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.group}>
        <AppText variant="label" color="textMuted">
          How you know her (optional)
        </AppText>
        <View style={styles.chips}>
          {CONTEXTS.map((context) => (
            <Chip
              key={context.id}
              testID={`context-${context.id}`}
              label={context.label}
              selected={context.id === session.context}
              onPress={() => session.setContext(context.id)}
              disabled={busy}
            />
          ))}
        </View>
      </View>

      <Button
        testID="generate-button"
        label={isAnalyse ? 'Analyse this chat' : session.sets.length > 0 ? 'Get lines in this tone' : 'Get lines'}
        onPress={session.generate}
        loading={session.phase === 'generating'}
        disabled={busy || !session.screenshot}
      />

      {/* Marks where the results begin, for scrolling to them. */}
      <View
        onLayout={(event) => {
          resultsTop.current = event.nativeEvent.layout.y;
        }}
      />

      {session.error ? (
        <Card testID="generate-error">
          <AppText testID="generate-error-message" color="danger" accessibilityRole="alert">
            {session.error.message}
          </AppText>
          {errorAction ? (
            <Button
              testID="generate-error-action"
              variant="ghost"
              size="sm"
              label={errorAction.label}
              style={styles.inlineAction}
              onPress={errorAction.run}
              disabled={busy}
            />
          ) : null}
        </Card>
      ) : null}

      {session.sets.length > 0 ? (
        <PersonRow username={session.username} onChange={session.setUsername} />
      ) : null}

      {session.kept.length > 0 ? (
        <View testID="kept-strip" style={styles.group}>
          <AppText variant="heading" accessibilityRole="header">
            Kept
          </AppText>
          {session.kept.map((line, position) => (
            <LineCard
              key={line.id}
              testKey={`kept-${position}`}
              text={line.text}
              caption={line.label}
              copied={session.copiedLineId === `kept:${line.id}`}
              kept
              onCopy={() => session.copyLine(`kept:${line.id}`, line.text)}
              onToggleKeep={() => session.toggleKeep(line)}
            />
          ))}
        </View>
      ) : null}

      {session.sets.map((set, index) => (
        <View key={set.id} style={styles.group}>
          <ResultSetView
            set={set}
            index={index}
            copiedLineId={session.copiedLineId}
            keptIds={keptIds}
            onCopy={session.copyLine}
            onToggleKeep={session.toggleKeep}
          />
          {index === 0 && canAdjust ? (
            <View style={styles.buttonRow}>
              <Button
                testID="adjust-new_lines"
                style={styles.fill}
                variant="secondary"
                size="sm"
                label="New lines"
                onPress={() => session.adjust('new_lines')}
                disabled={busy}
              />
              <Button
                testID="adjust-shorter"
                style={styles.fill}
                variant="secondary"
                size="sm"
                label="Shorter"
                onPress={() => session.adjust('shorter')}
                disabled={busy}
              />
              <Button
                testID="adjust-bolder"
                style={styles.fill}
                variant="secondary"
                size="sm"
                label="Bolder"
                onPress={() => session.adjust('bolder')}
                disabled={busy}
              />
            </View>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleLinks: { flexDirection: 'row', gap: spacing.md },
  titleLink: { paddingHorizontal: 0 },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
  inlineAction: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  preview: { height: 200, borderRadius: radius.lg, borderWidth: 1 },
});
