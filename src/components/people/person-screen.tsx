import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Banner,
  Icon,
  ListRow,
  OptionList,
  Screen,
  ScreenHeader,
  Sheet,
} from '@/components/ui';
import { DEFAULT_MODES, type ModeId } from '@/engine';
import { tonesTried, useHistory } from '@/history';
import { CONTEXT_LABELS, timeAgo } from '@/history/labels';
import type { ContextId } from '@/lib/database.types';
import { radius, spacing, useTheme } from '@/theme';

import { SHOT_STATUS } from './shot-status';
import { usePersonHistory } from './use-person-history';

const CONTEXTS = (Object.keys(CONTEXT_LABELS) as ContextId[]).map((id) => ({ value: id, label: CONTEXT_LABELS[id] }));

const modeLabel = (modeId: string) => DEFAULT_MODES[modeId as ModeId]?.label ?? modeId;

/** One person: who she is, and one row per screenshot Banter was used on. */
export function PersonScreen({ id }: { id: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const history = useHistory();
  const person = history.people.find((item) => item.id === id);
  const { state, screenshots, reload } = usePersonHistory(id);

  const [contextOpen, setContextOpen] = useState(false);
  /** A choice made here, shown at once. Until then the saved one is shown, whenever it arrives. */
  const [chosenContext, setChosenContext] = useState<ContextId | null>(null);
  const context = chosenContext ?? person?.context ?? null;

  const chooseContext = (next: ContextId) => {
    setContextOpen(false);
    if (!person || next === context) return;
    setChosenContext(next);
    void history.save({ kind: 'personContext', username: person.username, context: next });
  };

  if (!person) {
    return (
      <Screen testID="person-screen">
        <ScreenHeader title="Person not found" subtitle="She may have been removed." onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen testID="person-screen" contentStyle={styles.content}>
      <ScreenHeader onBack={() => router.back()} />
      <View style={styles.identity}>
        <Avatar name={person.username} size={56} />
        <View style={styles.fill}>
          <AppText testID="person-title" variant="title" accessibilityRole="header" numberOfLines={1}>
            @{person.username}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {timeAgo(person.last_interaction_at) ? `Last used ${timeAgo(person.last_interaction_at)}` : 'Not used yet'}
          </AppText>
        </View>
      </View>

      <ListRow
        testID="person-context-row"
        icon="person"
        title="How you know her"
        value={context ? CONTEXT_LABELS[context] : 'Not set'}
        onPress={() => setContextOpen(true)}
      />

      {state.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
      {state.status === 'error' ? (
        <Banner testID="timeline-error" tone="danger" action={{ label: 'Try again', onPress: reload }}>
          {state.message}
        </Banner>
      ) : null}
      {state.status === 'ready' && state.shots.length === 0 ? (
        <AppText testID="timeline-empty" color="textMuted">
          Nothing saved for her yet.
        </AppText>
      ) : null}

      {state.status === 'ready' && state.shots.length > 0 ? (
        <View style={styles.list}>
          <AppText variant="label" color="textMuted">
            Screenshots
          </AppText>
          {state.shots.map((shot, index) => {
            const status = SHOT_STATUS[shot.status];
            const link = shot.screenshotPath ? screenshots[shot.screenshotPath] : undefined;
            return (
              <ListRow
                key={shot.id}
                testID={`shot-row-${index}`}
                leading={
                  link ? (
                    <Image
                      source={{ uri: link }}
                      resizeMode="cover"
                      accessibilityLabel="Screenshot"
                      style={[styles.thumb, { borderColor: colors.border, backgroundColor: colors.raised }]}
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty, { borderColor: colors.border, backgroundColor: colors.raised }]}>
                      <Icon name="screenshot" size={18} color="textMuted" />
                    </View>
                  )
                }
                title={tonesTried(shot, modeLabel)}
                subtitle={`${status.label} · ${timeAgo(shot.latestAt) ?? ''}`}
                trailing={<Icon name={status.icon} size={18} color={status.color} />}
                onPress={() => router.push({ pathname: '/people/[id]/[shot]', params: { id, shot: shot.id } })}
              />
            );
          })}
        </View>
      ) : null}

      <Sheet
        testID="person-context-sheet"
        visible={contextOpen}
        title="How you know her"
        subtitle="Banter uses this when it writes lines for her."
        onClose={() => setContextOpen(false)}>
        <OptionList testIDPrefix="person-context" options={CONTEXTS} value={context} onSelect={chooseContext} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  fill: { flex: 1, gap: spacing.xxs },
  list: { gap: spacing.sm },
  thumb: { width: 40, height: 52, borderRadius: radius.sm, borderWidth: 1 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
});
