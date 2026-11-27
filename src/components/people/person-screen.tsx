import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Banner,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  OptionList,
  Screen,
  ScreenHeader,
  Button,
  Sheet,
  TextField,
  useToast,
} from '@/components/ui';
import { DEFAULT_MODES, type ModeId } from '@/engine';
import { tonesTried, useHistory } from '@/history';
import { CONTEXT_LABELS, timeAgo } from '@/history/labels';
import type { ContextId } from '@/lib/database.types';
import { radius, spacing, useTheme } from '@/theme';

import { SHOT_STATUS } from './shot-status';
import { usePersonHistory } from './use-person-history';

const CONTEXTS = (Object.keys(CONTEXT_LABELS) as ContextId[]).map((id) => ({ value: id, label: CONTEXT_LABELS[id] }));

/** Long enough for where things stand with her; short enough to stay one clear hint. */
const NOTES_MAX = 500;

const modeLabel = (modeId: string) => DEFAULT_MODES[modeId as ModeId]?.label ?? modeId;

/** One person: who she is, and one row per screenshot Banter was used on. */
export function PersonScreen({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const history = useHistory();
  const person = history.people.find((item) => item.id === id);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  /** A note saved here, shown at once. Until then the saved one is shown, whenever it arrives. */
  const [savedNotes, setSavedNotes] = useState<string | null | undefined>(undefined);
  const notes = savedNotes === undefined ? (person?.notes ?? null) : savedNotes;
  const [asking, setAsking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  const openNotes = () => {
    setNotesDraft(notes ?? '');
    setNotesOpen(true);
  };

  const saveNotes = () => {
    setNotesOpen(false);
    if (!person) return;
    const next = notesDraft.trim() || null;
    if (next === notes) return;
    setSavedNotes(next);
    // Saved through the queue like every change to her history, so it works offline too.
    void history.save({ kind: 'personNotes', username: person.username, notes: next });
    toast.show('Saved');
  };

  const remove = async () => {
    setDeleteError(null);
    setDeleting(true);
    const result = await history.removePerson(id);
    setDeleting(false);
    setAsking(false);
    if (!result.ok) return setDeleteError(result.message);
    toast.show('Deleted');
    router.back();
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
      <ScreenHeader
        onBack={() => router.back()}
        right={
          <IconButton
            testID="person-delete"
            icon="delete"
            label="Delete her history"
            color="danger"
            onPress={() => setAsking(true)}
          />
        }
      />
      {deleteError ? (
        <Banner tone="danger" messageTestID="person-delete-error">
          {deleteError}
        </Banner>
      ) : null}
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

      <ListRow
        testID="person-notes-row"
        icon="edit"
        title="About her"
        subtitle={notes ?? 'Add a note: how close you are, how she responds. Banter writes with it.'}
        onPress={openNotes}
      />

      {state.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
      {state.status === 'error' ? (
        <Banner testID="timeline-error" tone="danger" action={{ label: 'Try again', onPress: reload }}>
          {state.message}
        </Banner>
      ) : null}
      {state.status === 'ready' && state.shots.length === 0 ? (
        <EmptyState
          testID="timeline-empty"
          icon="screenshot"
          title="Nothing saved for her yet"
          message="Lines you get for her screenshots will be listed here."
        />
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

      <Dialog
        visible={asking}
        tone="danger"
        icon="delete"
        title={`Delete @${person.username}?`}
        message="Her lines and screenshots will be removed from Banter. This cannot be undone."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setAsking(false)}
      />

      <Sheet
        testID="person-notes-sheet"
        visible={notesOpen}
        title="About her"
        subtitle="Only for Banter. It reads this to judge how bold to be, and never quotes it to her."
        onClose={() => setNotesOpen(false)}>
        <TextField
          testID="person-notes-input"
          label="Your note"
          placeholder="Close friend, we flirt a lot, she flirts back"
          value={notesDraft}
          onChangeText={setNotesDraft}
          multiline
          maxLength={NOTES_MAX}
          helper={`${notesDraft.trim().length} of ${NOTES_MAX} characters`}
        />
        <View style={styles.sheetActions}>
          <Button style={styles.grow} variant="secondary" label="Cancel" onPress={() => setNotesOpen(false)} />
          <Button testID="person-notes-save" style={styles.grow} label="Save" onPress={saveNotes} />
        </View>
      </Sheet>

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
  sheetActions: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
});
