import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  Chip,
  ChipRow,
  Icon,
  ListRow,
  OptionList,
  Screen,
  SegmentedControl,
  Sheet,
} from '@/components/ui';
import { DEFAULT_MODES, type ContextId, type ModeId } from '@/engine';
import { useGenerateSession } from '@/generate/generate-provider';
import { CONTEXT_LABELS } from '@/history/labels';
import { haptics } from '@/lib/haptics';
import { usePrompts } from '@/prompts';
import { radius, spacing, useTheme } from '@/theme';

const MODE_IDS = Object.keys(DEFAULT_MODES) as ModeId[];
const CONTEXTS = (Object.keys(CONTEXT_LABELS) as ContextId[]).map((id) => ({ value: id, label: CONTEXT_LABELS[id] }));

/**
 * The Generate tab: choose a screenshot and how the lines should sound, then ask for them.
 * The lines themselves open on the Results screen. Everything here fits on one screen.
 */
export function GenerateScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const session = useGenerateSession();
  const prompts = usePrompts();
  const modes = MODE_IDS.map((mode) => ({ value: mode, label: prompts.modes[mode].label }));
  const [contextOpen, setContextOpen] = useState(false);

  const busy = session.phase !== 'idle';
  const isAnalyse = session.mode === 'analyse';
  const setCount = session.sets.length;

  // Results opens at once and shows the wait, the lines, or what went wrong. Opening it
  // here, on the tap, matters: a screen the app opens by itself after a wait can lose the
  // user's first tap on iOS (seen on the simulator: the tap never reached the app).
  const getLines = () => {
    router.push('/results');
    void session.generate().then((arrived) => (arrived ? haptics.success() : haptics.error()));
  };

  // Only a problem with choosing the screenshot is shown here. A failed request for lines
  // is shown on Results, where it was asked for.
  const screenshotError = session.error?.kind === 'screenshot' ? session.error : null;

  return (
    <Screen
      testID="generate-screen"
      fill
      edges={['top', 'left', 'right']}
      contentStyle={styles.content}
      footer={
        <View style={styles.footerRow}>
          {setCount > 0 ? (
            <Button
              testID="view-lines"
              style={styles.fill}
              variant="secondary"
              label={`Lines (${setCount})`}
              onPress={() => router.push('/results')}
              disabled={busy}
            />
          ) : null}
          <Button
            testID="generate-button"
            style={styles.main}
            icon="generate"
            label={isAnalyse ? 'Analyse this chat' : 'Get lines'}
            onPress={getLines}
            disabled={busy || !session.screenshot}
          />
        </View>
      }>
      <AppText variant="display" accessibilityRole="header">
        Banter
      </AppText>

      {!session.hasUsableKey ? (
        <Banner
          testID="no-key-notice"
          tone="warning"
          title="Add an AI key to start"
          action={{ testID: 'no-key-add', label: 'Add a key', onPress: () => router.push('/keys/add') }}>
          Banter writes lines with your own key from Gemini, OpenAI or Claude.
        </Banner>
      ) : null}

      {/* The screenshot takes whatever room the rest leaves. */}
      <View style={[styles.zone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {session.screenshot ? (
          <Image
            testID="screenshot-preview"
            source={{ uri: session.screenshot.previewUri }}
            resizeMode="contain"
            accessibilityLabel="The screenshot you chose"
            style={styles.preview}
          />
        ) : (
          <View testID="screenshot-empty" style={styles.empty}>
            <Icon name="screenshot" size={40} color="accent" />
            <AppText color="textMuted" style={styles.centerText}>
              Screenshot her story, profile or chat in Instagram, then choose it here.
            </AppText>
          </View>
        )}
      </View>
      <View style={styles.row}>
        <Button
          testID="use-latest"
          style={styles.fill}
          size="sm"
          variant={session.screenshot ? 'secondary' : 'primary'}
          icon="screenshot"
          label="Use latest"
          onPress={session.useLatestScreenshot}
          loading={session.phase === 'loadingScreenshot'}
          disabled={busy}
        />
        <Button
          testID="pick-gallery"
          style={styles.fill}
          size="sm"
          variant="secondary"
          icon="gallery"
          label="From gallery"
          onPress={session.pickScreenshot}
          disabled={busy}
        />
      </View>

      <SegmentedControl
        testIDPrefix="mode"
        options={modes}
        value={session.mode}
        onChange={session.setMode}
        disabled={busy}
      />

      {!isAnalyse ? (
        <ChipRow testID="tone-row">
          {prompts.tones.map((tone) => (
            <Chip
              key={tone.key}
              testID={`tone-${tone.key}`}
              label={tone.label}
              selected={tone.key === session.tone}
              onPress={() => session.setTone(tone.key)}
              disabled={busy}
            />
          ))}
        </ChipRow>
      ) : null}

      <ListRow
        testID="context-row"
        icon="person"
        title="How you know her"
        value={session.context ? CONTEXT_LABELS[session.context] : 'Not set'}
        onPress={() => setContextOpen(true)}
      />

      {screenshotError ? (
        <Banner
          testID="generate-error"
          tone="danger"
          messageTestID="generate-error-message"
          action={{
            testID: 'generate-error-action',
            label: 'Pick from gallery',
            onPress: session.pickScreenshot,
            disabled: busy,
          }}>
          {screenshotError.message}
        </Banner>
      ) : null}

      <Sheet
        testID="context-sheet"
        visible={contextOpen}
        title="How you know her"
        subtitle="Optional. Banter remembers it for this person. Tap the chosen one again to clear it."
        onClose={() => setContextOpen(false)}>
        <OptionList
          testIDPrefix="context"
          options={CONTEXTS}
          value={session.context}
          onSelect={(context) => {
            session.setContext(context);
            setContextOpen(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.md },
  zone: {
    flex: 1,
    minHeight: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  preview: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerText: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
  main: { flex: 2 },
});
