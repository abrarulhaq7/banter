import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, ListRow, Screen, ScreenHeader, Sheet, useToast } from '@/components/ui';
import { GOAL_MIN_WORDS, type TunedTone } from '@/engine';
import { haptics } from '@/lib/haptics';
import { useTuneTones, type TuneDeps } from '@/prompts/use-tune-tones';
import { spacing, useTheme } from '@/theme';

type TuneTonesScreenProps = {
  /** Tests replace the AI call. */
  deps?: Partial<TuneDeps>;
};

/**
 * About you > Tune my tones. Says which tones will be rewritten (only Banter's), and from
 * what. After the AI answers, each new version can be compared with the current one, and
 * nothing changes until Save all.
 */
export function TuneTonesScreen({ deps }: TuneTonesScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const tune = useTuneTones(deps);
  const [open, setOpen] = useState<TunedTone | null>(null);
  const [visible, setVisible] = useState(false);

  const names = (tones: { label: string }[]) => tones.map((tone) => tone.label).join(', ');
  const labelOf = (key: string) => tune.builtIn.find((tone) => (tone.toneId ?? tone.key) === key);

  const saveAll = async () => {
    if (await tune.saveAll()) {
      haptics.success();
      toast.show(`${tune.result?.tones.length ?? 0} tones tuned`);
      router.back();
    }
  };

  if (tune.phase === 'done' || tune.phase === 'saving') {
    return (
      <Screen
        testID="tune-screen"
        footer={
          <View style={styles.row}>
            <Button style={styles.fill} variant="secondary" label="Cancel" onPress={() => router.back()} disabled={tune.phase === 'saving'} />
            <Button testID="tune-save" style={styles.fill} label="Save all" onPress={saveAll} loading={tune.phase === 'saving'} />
          </View>
        }>
        <ScreenHeader
          title="Your tuned tones"
          subtitle="Open one to compare. Nothing changes until you save."
          onBack={() => router.back()}
        />
        {tune.result?.summary ? (
          <Banner tone="info" messageTestID="tune-summary">
            {tune.result.summary}
          </Banner>
        ) : null}
        {tune.error ? (
          <Banner tone="danger" messageTestID="tune-error">
            {tune.error}
          </Banner>
        ) : null}
        <View style={styles.list}>
          {(tune.result?.tones ?? []).map((tone) => (
            <ListRow
              key={tone.key}
              testID={`tuned-${tone.key}`}
              icon="tone"
              title={labelOf(tone.key)?.label ?? tone.key}
              subtitle={tone.change || tone.definition}
              onPress={() => {
                setOpen(tone);
                setVisible(true);
              }}
            />
          ))}
        </View>

        <Sheet
          testID="tuned-sheet"
          visible={visible}
          title={open ? (labelOf(open.key)?.label ?? open.key) : ''}
          subtitle={open?.change || undefined}
          onClose={() => setVisible(false)}>
          <ScrollView style={styles.compare} contentContainerStyle={styles.list}>
            <AppText variant="label" color="textMuted">
              Now
            </AppText>
            <AppText testID="tuned-current" variant="label">
              {open ? (labelOf(open.key)?.definition ?? '') : ''}
            </AppText>
            <AppText variant="label" color="accent">
              Tuned
            </AppText>
            <AppText testID="tuned-new">{open?.definition ?? ''}</AppText>
          </ScrollView>
        </Sheet>
      </Screen>
    );
  }

  return (
    <Screen
      testID="tune-screen"
      fill
      footer={
        <Button
          testID="tune-run"
          icon="generate"
          label={`Tune ${tune.builtIn.length} tones`}
          onPress={() => {
            void tune.ask().then((done) => (done ? haptics.success() : undefined));
          }}
          disabled={!tune.enoughGoal || !tune.hasUsableKey || tune.phase !== 'idle'}
          loading={tune.phase === 'asking'}
        />
      }>
      <ScreenHeader
        title="Tune my tones"
        subtitle="Banter rewrites its own tones to fit what you want and how you text."
        onBack={() => router.back()}
      />

      {tune.enoughGoal ? (
        <Card variant="tinted" testID="tune-goal">
          <AppText variant="label" color="textMuted">
            From what you wrote
          </AppText>
          <AppText numberOfLines={5}>“{tune.goal}”</AppText>
        </Card>
      ) : (
        <Banner
          testID="tune-need-goal"
          tone="warning"
          title="Tell Banter more first"
          action={{ testID: 'tune-write-goal', label: 'Write it in About you', onPress: () => router.back() }}>
          {`You wrote ${tune.goalWords} ${tune.goalWords === 1 ? 'word' : 'words'} under "What you want from Banter". Write at least ${GOAL_MIN_WORDS}, so there is enough to tune by.`}
        </Banner>
      )}

      <Card testID="tune-which">
        <AppText variant="label" color="textMuted">
          These will be rewritten
        </AppText>
        <AppText testID="tune-built-in" variant="bodyStrong">
          {names(tune.builtIn)}
        </AppText>
        <AppText variant="label" color="textMuted">
          {tune.own.length > 0 ? 'These stay as they are' : 'Tones you make yourself stay as they are.'}
        </AppText>
        {tune.own.length > 0 ? <AppText testID="tune-own">{names(tune.own)}</AppText> : null}
      </Card>

      {!tune.hasUsableKey ? (
        <Banner testID="tune-no-key" tone="warning" title="No AI key to use">
          This needs one working key, like writing lines does.
        </Banner>
      ) : null}
      {tune.error ? (
        <Banner tone="danger" messageTestID="tune-error">
          {tune.error}
        </Banner>
      ) : null}
      {tune.phase === 'asking' ? (
        <View testID="tune-asking" style={styles.asking}>
          <ActivityIndicator color={colors.accent} />
          <AppText color="textMuted">Rewriting your tones…</AppText>
        </View>
      ) : null}

      <AppText variant="caption" color="textMuted">
        Starts from Banter’s own wording each time. Reset tones on About you puts it back.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
  compare: { maxHeight: 360 },
  asking: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
