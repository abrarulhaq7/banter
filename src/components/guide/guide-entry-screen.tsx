import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Icon, Screen, ScreenHeader } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

import { guideEntry, type GuideSetup, type GuideTopic } from './guide-content';

/** Guide > one setup or one kind of option. */
export function GuideEntryScreen({ id }: { id: string }) {
  const router = useRouter();
  const entry = guideEntry(id);
  const back = () => router.back();

  if (!entry) {
    return (
      <Screen testID="guide-entry-screen" fill>
        <ScreenHeader title="Not found" subtitle="This part of the guide is gone." onBack={back} />
      </Screen>
    );
  }
  return entry.kind === 'setup' ? (
    <SetupView setup={entry.setup} onBack={back} />
  ) : (
    <TopicView topic={entry.topic} onBack={back} />
  );
}

/** A situation: the options to pick, why they work, and an example. Fits on one screen. */
function SetupView({ setup, onBack }: { setup: GuideSetup; onBack: () => void }) {
  return (
    <Screen testID="guide-setup-screen" fill>
      <ScreenHeader title={setup.title} titleTestID="guide-title" onBack={onBack} />

      <Card testID="guide-choose">
        <AppText variant="label" color="textMuted">
          Pick these on Generate
        </AppText>
        <View style={styles.pills}>
          {setup.choose.map((choice) => (
            <Pill key={choice} label={choice} />
          ))}
        </View>
        {setup.alsoTry ? (
          <AppText testID="guide-also" variant="caption" color="textMuted">
            {`Also works: ${setup.alsoTry}`}
          </AppText>
        ) : null}
      </Card>

      <View style={styles.block}>
        <View style={styles.heading}>
          <Icon name="idea" size={18} color="accent" />
          <AppText variant="bodyStrong">Why it works</AppText>
        </View>
        <AppText testID="guide-why" color="textMuted">
          {setup.why}
        </AppText>
      </View>

      <Card variant="tinted" testID="guide-example">
        <View style={styles.heading}>
          <Icon name="quote" size={18} color="accent" />
          <AppText variant="bodyStrong">{setup.example.label}</AppText>
        </View>
        <AppText variant="caption" color="textMuted">
          {setup.example.scene}
        </AppText>
        <AppText testID="guide-example-line">{`"${setup.example.line}"`}</AppText>
      </Card>
    </Screen>
  );
}

/** One kind of option: each choice with what it does. A list, so it may scroll. */
function TopicView({ topic, onBack }: { topic: GuideTopic; onBack: () => void }) {
  return (
    <Screen testID="guide-topic-screen">
      <ScreenHeader title={topic.title} titleTestID="guide-title" subtitle={topic.subtitle} onBack={onBack} />
      <View style={styles.list}>
        {topic.items.map((item) => (
          <Card key={item.name} testID={`guide-item-${item.name}`}>
            <AppText variant="bodyStrong">{item.name}</AppText>
            <AppText color="textMuted">{item.text}</AppText>
          </Card>
        ))}
      </View>
      {topic.note ? (
        <AppText testID="guide-note" variant="caption" color="textMuted">
          {topic.note}
        </AppText>
      ) : null}
    </Screen>
  );
}

/** An option as it reads on Generate. Shown, not tapped. */
function Pill({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <AppText variant="label" color="accent">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  block: { gap: spacing.xs },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { gap: spacing.sm },
});
