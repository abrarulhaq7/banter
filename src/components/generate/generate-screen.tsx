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
  IconButton,
  ListRow,
  OptionList,
  Screen,
  SegmentedControl,
  Sheet,
  TextField,
  useToast,
} from '@/components/ui';
import { DEFAULT_MODES, type ContextId, type ModeId } from '@/engine';
import { useGenerateSession } from '@/generate/generate-provider';
import { useHistory } from '@/history';
import { CONTEXT_LABELS } from '@/history/labels';
import { haptics } from '@/lib/haptics';
import { usePrompts } from '@/prompts';
import { useToneVisibility } from '@/prompts/use-tone-visibility';
import { ToneSheet } from '@/components/tones/tone-sheet';
import { radius, spacing, useTheme } from '@/theme';

const MODE_IDS = Object.keys(DEFAULT_MODES) as ModeId[];
const CONTEXTS = (Object.keys(CONTEXT_LABELS) as ContextId[]).map((id) => ({ value: id, label: CONTEXT_LABELS[id] }));
/** The "let Banter read her username" choice in the Who is she sheet. */
const SOMEONE_NEW = '__new__';
/** How many people the Who is she sheet lists; a search field finds the rest. */
const PEOPLE_SHOWN = 6;

/**
 * The Generate tab: choose a screenshot and how the lines should sound, then ask for them.
 * The lines themselves open on the Results screen. Everything here fits on one screen.
 */
export function GenerateScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const session = useGenerateSession();
  const toast = useToast();
  const prompts = usePrompts();
  const modes = MODE_IDS.map((mode) => ({ value: mode, label: prompts.modes[mode].label }));
  const history = useHistory();
  const [contextOpen, setContextOpen] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const { shown: shownTones } = useToneVisibility();
  // The tone in use always shows, even one hidden from this screen, so the choice is visible.
  const currentTone = prompts.tones.find((tone) => tone.key === session.tone);
  const chipTones =
    currentTone && !shownTones.some((tone) => tone.key === currentTone.key) ? [currentTone, ...shownTones] : shownTones;
  const [personOpen, setPersonOpen] = useState(false);
  const [personQuery, setPersonQuery] = useState('');

  // Who she is can be said before asking, so the first set knows her. Only for a chosen
  // screenshot (a new one starts over) and only once there is anyone saved to choose from.
  const canChoosePerson = Boolean(session.screenshot) && history.people.length > 0;
  const query = personQuery.trim().replace(/^@/, '').toLowerCase();
  const personOptions = [
    ...(session.sets.length === 0
      ? [{ value: SOMEONE_NEW, label: 'Someone new', subtitle: 'Banter reads her username from the screenshot' }]
      : []),
    ...history.people
      .filter((person) => !query || person.username.includes(query))
      .slice(0, PEOPLE_SHOWN)
      .map((person) => ({
        value: person.username,
        label: `@${person.username}`,
        subtitle: [person.context ? CONTEXT_LABELS[person.context] : null, person.notes ? 'Has a note' : null]
          .filter(Boolean)
          .join(' · ') || undefined,
      })),
  ];

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

  const clear = () => {
    const hadLines = setCount > 0;
    session.clear();
    haptics.tap();
    if (hadLines) toast.show('Cleared. Your lines are saved under People', 'info');
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
          <>
            <Image
              testID="screenshot-preview"
              source={{ uri: session.screenshot.previewUri }}
              resizeMode="contain"
              accessibilityLabel="The screenshot you chose"
              style={styles.preview}
            />
            <IconButton
              testID="clear-screenshot"
              icon="close"
              label="Clear, to start with a new screenshot"
              variant="filled"
              onPress={clear}
              disabled={busy}
              style={styles.clear}
            />
          </>
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
          <Chip testID="tone-all" icon="tone" label="Tones" onPress={() => setToneOpen(true)} disabled={busy} />
          {chipTones.map((tone) => (
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

      {canChoosePerson ? (
        <ListRow
          testID="person-pick-row"
          icon="people"
          title="Who is she"
          value={session.username ? `@${session.username}` : 'Banter reads it'}
          onPress={() => {
            setPersonQuery('');
            setPersonOpen(true);
          }}
          disabled={busy}
        />
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

      <ToneSheet
        testID="tone-picker-sheet"
        visible={toneOpen}
        title="Tones"
        subtitle="Tap one to use it. The eye shows it on this screen or hides it."
        selectedKey={session.tone}
        onSelect={(key) => {
          session.setTone(key);
          setToneOpen(false);
        }}
        onClose={() => setToneOpen(false)}
      />

      <Sheet
        testID="person-pick-sheet"
        visible={personOpen}
        title="Who is she"
        subtitle="Pick her if she is saved: Banter then knows your note about her and what you sent her before."
        onClose={() => setPersonOpen(false)}>
        {history.people.length > PEOPLE_SHOWN ? (
          <TextField
            testID="person-pick-search"
            label="Search"
            placeholder="username"
            value={personQuery}
            onChangeText={setPersonQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : null}
        <OptionList
          testIDPrefix="person-pick"
          options={personOptions}
          value={session.username ?? SOMEONE_NEW}
          onSelect={(value) => {
            session.choosePerson(value === SOMEONE_NEW ? null : value);
            setPersonOpen(false);
          }}
        />
      </Sheet>

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
  clear: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerText: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
  main: { flex: 2 },
});
