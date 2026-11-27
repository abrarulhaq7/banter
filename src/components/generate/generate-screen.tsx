import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  Chip,
  ChipRow,
  Icon,
  IconButton,
  OptionList,
  Screen,
  SegmentedControl,
  SettingChip,
  Sheet,
  TextField,
  useToast,
} from '@/components/ui';
import { DEFAULT_MODES, type ContextId, type Direction, type ModeId, type ToneId } from '@/engine';
import type { Answers, QuickPick } from '@/generate/quick-questions';
import { DIRECTION_LABEL } from '@/generate/session';
import { useIncomingScreenshot } from '@/generate/use-incoming-screenshot';
import { useGenerateSession } from '@/generate/generate-provider';
import { profileSettings, replyLanguage, useProfile } from '@/data';
import { useHistory } from '@/history';
import { CONTEXT_LABELS } from '@/history/labels';
import { haptics } from '@/lib/haptics';
import { usePrompts } from '@/prompts';
import { useToneVisibility } from '@/prompts/use-tone-visibility';
import { ToneSheet } from '@/components/tones/tone-sheet';
import { radius, spacing, useTheme } from '@/theme';

import { QuickQuestionsSheet } from './quick-questions-sheet';

const MODE_IDS = Object.keys(DEFAULT_MODES) as ModeId[];
const CONTEXTS = (Object.keys(CONTEXT_LABELS) as ContextId[]).map((id) => ({ value: id, label: CONTEXT_LABELS[id] }));
const DIRECTIONS: { value: Direction; label: string; subtitle: string }[] = [
  { value: 'keep_going', label: DIRECTION_LABEL.keep_going, subtitle: 'Lines that keep the conversation going.' },
  {
    value: 'heat_up',
    label: DIRECTION_LABEL.heat_up,
    subtitle: 'One step hotter than the chat is now, if she is matching you. For someone you know.',
  },
  { value: 'ask_out', label: DIRECTION_LABEL.ask_out, subtitle: 'Specific, low-pressure ways to suggest meeting.' },
];

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
  // An image shared to Banter from another app (Android's share menu) becomes the screenshot.
  useIncomingScreenshot(session.openSharedScreenshot, session.phase === 'idle');
  const toast = useToast();
  const prompts = usePrompts();
  const modes = MODE_IDS.map((mode) => ({ value: mode, label: prompts.modes[mode].label }));
  const history = useHistory();
  const [contextOpen, setContextOpen] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const { profile, save: saveProfile } = useProfile();
  /** The language just picked, shown while it is saved to the profile. */
  const [pendingLanguage, setPendingLanguage] = useState<'english' | 'roman_urdu' | null>(null);
  const language = pendingLanguage ?? replyLanguage(profile);
  const toggleLanguage = () => {
    const next = language === 'roman_urdu' ? 'english' : 'roman_urdu';
    setPendingLanguage(next);
    void saveProfile({ settings: { ...profileSettings(profile), reply_language: next } }).then((result) => {
      setPendingLanguage(null);
      if (!result.ok) toast.show('Could not change the language. Check your internet.', 'danger');
      else toast.show(next === 'roman_urdu' ? 'Lines in Roman Urdu' : 'Lines in English', 'info');
    });
  };
  const [directionOpen, setDirectionOpen] = useState(false);
  const isReply = session.mode === 'reply';
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
        subtitle:
          [person.context ? CONTEXT_LABELS[person.context] : null, person.notes ? 'Has a note' : null]
            .filter(Boolean)
            .join(' · ') || undefined,
      })),
  ];

  const busy = session.phase !== 'idle';
  const isAnalyse = session.mode === 'analyse';
  const setCount = session.sets.length;

  // The quick questions pick the setup for the best reply. They open by themselves once for
  // each new screenshot (unless turned off), and from "Help me pick" at any time.
  const [pendingAsk, setPendingAsk] = useState<boolean | null>(null);
  const askOnPick = (pendingAsk ?? profileSettings(profile).quick_questions) !== false;
  const shotUri = session.screenshot?.previewUri ?? null;
  /** The screenshot the questions were answered or skipped for, so they ask only once. */
  const [quickDoneFor, setQuickDoneFor] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  /** Counts the times they were opened by hand, so each opening starts from the screen's choices. */
  const [quickOpens, setQuickOpens] = useState(0);
  const otherSheetOpen = contextOpen || toneOpen || directionOpen || personOpen;
  const quickAuto =
    askOnPick && shotUri !== null && quickDoneFor !== shotUri && !isAnalyse && !busy && setCount === 0 && !otherSheetOpen;
  const openQuick = () => {
    setQuickOpens((count) => count + 1);
    setQuickOpen(true);
  };
  const closeQuick = () => {
    setQuickOpen(false);
    setQuickDoneFor(shotUri);
  };
  const toneLabel = (tone: ToneId) => prompts.tones.find((item) => item.key === tone)?.label ?? tone;
  const applyQuick = (answers: Answers, pick: QuickPick) => {
    if (pick.mode !== session.mode) session.setMode(pick.mode);
    if (answers.context !== session.context) {
      // Choosing the context that is already set clears it, so clearing is done that way.
      const toggle = answers.context ?? session.context;
      if (toggle) session.setContext(toggle);
    }
    // A built-in tone's key is its id.
    if (prompts.tones.some((tone) => tone.key === pick.tone)) session.setTone(pick.tone);
    if (pick.mode === 'reply') session.setDirection(pick.direction);
    closeQuick();
    haptics.tap();
    const heading = pick.direction === 'keep_going' ? '' : ` · ${DIRECTION_LABEL[pick.direction]}`;
    toast.show(`${toneLabel(pick.tone)}${heading}, from your answers. Tap a tone to change it.`, 'info');
  };
  const toggleAsk = () => {
    const next = !askOnPick;
    // The sheet stays open: turning the questions off is not an answer to them.
    setQuickOpen(true);
    setPendingAsk(next);
    void saveProfile({ settings: { ...profileSettings(profile), quick_questions: next } }).then((result) => {
      setPendingAsk(null);
      if (!result.ok) toast.show('Could not save that. Check your internet.', 'danger');
    });
  };

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
      <View style={styles.titleRow}>
        <AppText variant="display" accessibilityRole="header">
          Banter
        </AppText>
        <IconButton
          testID="open-guide"
          icon="guide"
          label="Guide: which options to pick"
          variant="filled"
          color="accent"
          onPress={() => router.push('/guide')}
        />
      </View>

      {!session.hasUsableKey ? (
        <Banner
          testID="no-key-notice"
          tone="warning"
          title="Add an AI key to start"
          action={{ testID: 'no-key-add', label: 'Add a key', onPress: () => router.push('/keys/add') }}>
          Banter writes lines with your own AI key. Gemini, Groq and OpenRouter have free tiers.
        </Banner>
      ) : null}

      {/* The screenshot takes whatever room the rest leaves. Choosing it happens inside. */}
      <View style={[styles.zone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {session.phase === 'loadingScreenshot' ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : session.screenshot ? (
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
            {/* Another screenshot, without clearing first. */}
            <View style={styles.swap}>
              <IconButton
                testID="use-latest"
                icon="screenshot"
                label="Use latest"
                variant="filled"
                onPress={session.useLatestScreenshot}
                disabled={busy}
              />
              <IconButton
                testID="pick-gallery"
                icon="gallery"
                label="From gallery"
                variant="filled"
                onPress={session.pickScreenshot}
                disabled={busy}
              />
            </View>
          </>
        ) : (
          <View testID="screenshot-empty" style={styles.empty}>
            <Icon name="screenshot" size={36} color="accent" />
            <AppText color="textMuted" style={styles.centerText}>
              Screenshot her story, profile or chat in Instagram, then choose it.
            </AppText>
            <View style={styles.row}>
              <Button
                testID="use-latest"
                size="sm"
                icon="screenshot"
                label="Use latest"
                onPress={session.useLatestScreenshot}
                disabled={busy}
              />
              <Button
                testID="pick-gallery"
                size="sm"
                variant="secondary"
                icon="gallery"
                label="From gallery"
                onPress={session.pickScreenshot}
                disabled={busy}
              />
            </View>
          </View>
        )}
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
          <Chip testID="quick-questions-open" icon="idea" label="Help me pick" onPress={openQuick} disabled={busy} />
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

      {/* The rest of the request on one wrapped line: each pill opens its own choice. */}
      <View testID="request-settings" style={styles.settings}>
        {canChoosePerson ? (
          <SettingChip
            testID="person-pick-row"
            icon="people"
            label="Who is she"
            value={session.username ? `@${session.username}` : null}
            onPress={() => {
              setPersonQuery('');
              setPersonOpen(true);
            }}
            disabled={busy}
          />
        ) : null}
        <SettingChip
          testID="context-row"
          icon="person"
          label="How you know her"
          value={session.context ? CONTEXT_LABELS[session.context] : null}
          onPress={() => setContextOpen(true)}
          disabled={busy}
        />
        {isReply ? (
          <SettingChip
            testID="direction-row"
            icon="bolder"
            tone={session.direction === 'heat_up' ? 'warning' : 'accent'}
            label="Where to take it"
            value={DIRECTION_LABEL[session.direction]}
            onPress={() => setDirectionOpen(true)}
            disabled={busy}
          />
        ) : null}
        <SettingChip
          testID="language-row"
          icon="language"
          label="Language"
          value={language === 'roman_urdu' ? 'Roman Urdu' : 'English'}
          onPress={toggleLanguage}
          disabled={busy}
        />
      </View>

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

      <QuickQuestionsSheet
        key={`${shotUri ?? 'none'}:${quickOpens}`}
        visible={quickOpen || quickAuto}
        kind={session.mode === 'analyse' ? 'story_reply' : session.mode}
        context={session.context}
        toneLabel={toneLabel}
        askOnPick={askOnPick}
        onToggleAsk={toggleAsk}
        onApply={applyQuick}
        onClose={closeQuick}
      />

      <Sheet
        testID="direction-sheet"
        visible={directionOpen}
        title="Where to take it"
        subtitle="Banter reads the chat first and tells you where it stands."
        onClose={() => setDirectionOpen(false)}>
        <OptionList
          testIDPrefix="direction"
          options={DIRECTIONS}
          value={session.direction}
          onSelect={(direction) => {
            session.setDirection(direction);
            setDirectionOpen(false);
          }}
        />
      </Sheet>

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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  zone: {
    flex: 1,
    minHeight: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  preview: { flex: 1 },
  clear: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  swap: { position: 'absolute', bottom: spacing.sm, right: spacing.sm, gap: spacing.sm },
  settings: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerText: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
  main: { flex: 2 },
});
