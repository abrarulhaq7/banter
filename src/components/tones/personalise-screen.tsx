import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  Card,
  ListRow,
  Screen,
  ScreenHeader,
  Sheet,
  useToast,
} from '@/components/ui';
import type { ToneSuggestion } from '@/engine';
import { haptics } from '@/lib/haptics';
import { usePrompts } from '@/prompts';
import { usePersonalise, type Evidence, type PersonaliseDeps } from '@/prompts/use-personalise';
import { spacing, useTheme } from '@/theme';

type PersonaliseScreenProps = {
  /** Tests replace the AI call. */
  deps?: Partial<PersonaliseDeps>;
};

type Decision = 'accepted' | 'skipped';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function evidenceText(evidence: Evidence): string {
  const parts = [
    count(evidence.copied, 'line you copied', 'lines you copied'),
    count(evidence.replied, 'that got a reply', 'that got a reply'),
    count(evidence.noReply, 'that did not', 'that did not'),
  ];
  return `${parts.join(', ')}. "How you text" is ${evidence.hasStyle ? 'filled in' : 'empty'}.`;
}

/**
 * "Personalise for me": the AI reads how the user's lines went and proposes changes to
 * their tones. Nothing changes until a proposal is accepted, one tone at a time.
 */
export function PersonaliseScreen({ deps }: PersonaliseScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const prompts = usePrompts();
  const personalise = usePersonalise(deps);
  const [open, setOpen] = useState<ToneSuggestion | null>(null);
  const [visible, setVisible] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { evidence, phase, result } = personalise;
  const nothingToRead = evidence !== null && evidence.copied === 0 && !evidence.hasStyle;
  const canAsk = evidence !== null && !nothingToRead && personalise.hasUsableKey && phase !== 'asking';

  const ask = async () => {
    setDecisions({});
    const arrived = await personalise.ask();
    if (arrived) haptics.success();
    else haptics.error();
  };

  const show = (suggestion: ToneSuggestion) => {
    setSaveError(null);
    setOpen(suggestion);
    setVisible(true);
  };

  const decide = async (decision: Decision) => {
    if (!open) return;
    if (decision === 'accepted') {
      const tone = prompts.tones.find((item) => item.key === open.key);
      if (!tone) return setVisible(false);
      setBusy(true);
      const saved =
        tone.kind === 'custom'
          ? await prompts.updateCustomTone(tone.key, tone.label, open.definition)
          : await prompts.saveToneDefinition(tone.toneId ?? '', open.definition);
      setBusy(false);
      if (!saved.ok) return setSaveError(saved.message);
      haptics.tap();
      toast.show(`${tone.label} updated`);
    }
    setDecisions((previous) => ({ ...previous, [open.key]: decision }));
    setVisible(false);
  };

  const openTone = open ? prompts.tones.find((item) => item.key === open.key) : undefined;
  // What the tone said when the suggestion was made: after accepting, the two are the same.
  const [before, setBefore] = useState<Record<string, string>>({});
  const rememberBefore = () =>
    setBefore(Object.fromEntries(prompts.tones.map((tone) => [tone.key, tone.definition])));

  const footer =
    phase === 'done' ? (
      <Button testID="personalise-done" label="Done" onPress={() => router.back()} />
    ) : (
      <Button
        testID="personalise-run"
        icon="generate"
        label="Suggest changes"
        onPress={() => {
          rememberBefore();
          void ask();
        }}
        disabled={!canAsk}
        loading={phase === 'asking'}
      />
    );

  return (
    <Screen testID="personalise-screen" fill={phase !== 'done'} footer={footer}>
      <ScreenHeader
        title="Personalise for me"
        subtitle={
          phase === 'done'
            ? 'Open a suggestion to compare. Nothing changes until you accept it.'
            : 'The AI reads how your lines went and suggests changes to your tones. You decide on each one.'
        }
        onBack={() => router.back()}
      />

      {phase !== 'done' ? (
        <>
          {personalise.historyError ? (
            <Banner
              tone="danger"
              messageTestID="personalise-history-error"
              action={{ label: 'Try again', onPress: () => void personalise.reloadHistory() }}>
              {personalise.historyError}
            </Banner>
          ) : evidence === null ? (
            <View testID="personalise-loading" style={styles.row}>
              <ActivityIndicator color={colors.accent} />
              <AppText color="textMuted">Reading your history…</AppText>
            </View>
          ) : (
            <Card testID="personalise-evidence">
              <AppText variant="label" color="textMuted">
                What it will read
              </AppText>
              <AppText testID="personalise-evidence-text">{evidenceText(evidence)}</AppText>
            </Card>
          )}

          {nothingToRead ? (
            <Banner
              testID="personalise-not-enough"
              tone="warning"
              title="Not enough to go on yet"
              action={{ label: 'Open About you', onPress: () => router.push('/profile'), testID: 'personalise-open-profile' }}>
              Copy a few lines Banter writes for you, or fill in &quot;How you text&quot; in About you.
            </Banner>
          ) : null}
          {!personalise.hasUsableKey ? (
            <Banner
              testID="personalise-no-key"
              tone="warning"
              title="No AI key to use"
              action={{ label: 'Open AI keys', onPress: () => router.push('/keys') }}>
              This needs one working key, like writing lines does.
            </Banner>
          ) : null}
          {personalise.error ? (
            <Banner tone="danger" messageTestID="personalise-error">
              {personalise.error}
            </Banner>
          ) : null}

          {phase === 'asking' ? (
            <View testID="personalise-asking" style={styles.row}>
              <ActivityIndicator color={colors.accent} />
              <AppText color="textMuted">Reading how your lines went…</AppText>
            </View>
          ) : null}

          <AppText variant="caption" color="textMuted">
            Sent to your AI provider with your own key: your tones, your About you facts and the lines
            Banter wrote for you. No screenshots and no usernames.
          </AppText>
        </>
      ) : (
        <>
          {result?.summary ? (
            <Banner tone="info" messageTestID="personalise-summary">
              {result.summary}
            </Banner>
          ) : null}

          {result && result.suggestions.length === 0 ? (
            <AppText testID="personalise-none" color="textMuted">
              No changes suggested. Your tones stay as they are.
            </AppText>
          ) : null}

          <View style={styles.list}>
            {(result?.suggestions ?? []).map((suggestion) => {
              const tone = prompts.tones.find((item) => item.key === suggestion.key);
              const decision = decisions[suggestion.key];
              return (
                <ListRow
                  key={suggestion.key}
                  testID={`suggestion-${suggestion.key}`}
                  icon={decision === 'accepted' ? 'success' : 'tone'}
                  tone={decision === 'accepted' ? 'success' : 'accent'}
                  title={tone?.label ?? suggestion.key}
                  subtitle={suggestion.reason || 'A suggested change.'}
                  value={decision === 'accepted' ? 'Accepted' : decision === 'skipped' ? 'Skipped' : undefined}
                  onPress={() => show(suggestion)}
                />
              );
            })}
          </View>
        </>
      )}

      <Sheet
        testID="suggestion-sheet"
        visible={visible}
        title={openTone?.label ?? 'Suggestion'}
        subtitle={open?.reason || undefined}
        onClose={() => setVisible(false)}>
        <ScrollView style={styles.compare} contentContainerStyle={styles.compareContent}>
          <AppText variant="label" color="textMuted">
            Now
          </AppText>
          <AppText testID="suggestion-current" variant="label">
            {open ? (before[open.key] ?? openTone?.definition ?? '') : ''}
          </AppText>
          <AppText variant="label" color="accent">
            Suggested
          </AppText>
          <AppText testID="suggestion-proposed">{open?.definition ?? ''}</AppText>
        </ScrollView>
        {saveError ? (
          <Banner tone="danger" messageTestID="suggestion-error">
            {saveError}
          </Banner>
        ) : null}
        <View style={styles.actions}>
          <Button
            testID="suggestion-skip"
            style={styles.fill}
            variant="secondary"
            label="Skip"
            onPress={() => decide('skipped')}
            disabled={busy}
          />
          <Button
            testID="suggestion-accept"
            style={styles.fill}
            label="Use this"
            onPress={() => decide('accepted')}
            loading={busy}
            disabled={open ? decisions[open.key] === 'accepted' : false}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  list: { gap: spacing.sm },
  compare: { maxHeight: 340 },
  compareContent: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
});
