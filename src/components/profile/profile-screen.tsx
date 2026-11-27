import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Dialog, ListRow, Screen, ScreenHeader, Sheet, TextField, useToast } from '@/components/ui';
import { fieldsFromProfile, patchFromFields, profileGoal, profileSettings, useProfile, validateProfile } from '@/data';
import { GOAL_MIN_WORDS, wordCount } from '@/engine';
import { usePrompts } from '@/prompts';
import { spacing } from '@/theme';

import { ALL_FIELDS, GOAL_FIELD, PROFILE_FIELDS, type ProfileFieldId } from './profile-fields';

type Editing = ProfileFieldId | 'goal';

/**
 * Settings > About you: one row per fact, showing what is saved. A row opens a sheet to
 * change it. At the bottom: tune Banter's tones to what the user wants, or put them back.
 */
export function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, save } = useProfile();
  const prompts = usePrompts();
  const saved = fieldsFromProfile(profile);
  const goal = profileGoal(profile);

  // The field stays set while the sheet slides away, so its title does not blank out.
  const [field, setField] = useState<Editing>('name');
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [askingReset, setAskingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const edited = prompts.tones.filter((tone) => tone.kind === 'edited').length;

  const open = (next: Editing) => {
    setDraft(next === 'goal' ? (goal ?? '') : saved[next]);
    setError(null);
    setField(next);
    setVisible(true);
  };

  const submit = async () => {
    let result;
    if (field === 'goal') {
      setBusy(true);
      result = await save({ settings: { ...profileSettings(profile), goal: draft.trim() } });
    } else {
      const next = { ...saved, [field]: draft };
      const problem = validateProfile(next)[field];
      if (problem) return setError(problem);
      setBusy(true);
      result = await save(patchFromFields(next));
    }
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setVisible(false);
    toast.show('Saved');
  };

  const reset = async () => {
    setResetting(true);
    const result = await prompts.resetBuiltInTones();
    setResetting(false);
    setAskingReset(false);
    toast.show(result.ok ? "Banter's tones are back to how Banter wrote them" : result.message, result.ok ? 'success' : 'danger');
  };

  const spec = field === 'goal' ? GOAL_FIELD : PROFILE_FIELDS[field];
  const words = wordCount(draft);

  return (
    <Screen
      testID="profile-screen"
      fill
      footer={
        <View style={styles.row}>
          <Button
            testID="tones-reset"
            style={styles.fill}
            variant="secondary"
            label="Reset tones"
            onPress={() => setAskingReset(true)}
            disabled={edited === 0}
          />
          <Button
            testID="tones-tune"
            style={styles.fill}
            icon="generate"
            label="Tune my tones"
            onPress={() => router.push('/tones/tune')}
          />
        </View>
      }>
      <ScreenHeader
        title="About you"
        subtitle="Banter uses these, when they help, to make lines sound like you."
        onBack={() => router.back()}
      />

      <View style={styles.list}>
        <ListRow
          testID="profile-row-goal"
          icon={GOAL_FIELD.icon}
          title={GOAL_FIELD.title}
          subtitle={goal ?? `Not set. A few detailed sentences, at least ${GOAL_MIN_WORDS} words.`}
          onPress={() => open('goal')}
        />
        {ALL_FIELDS.map((id) => (
          <ListRow
            key={id}
            testID={`profile-row-${id}`}
            icon={PROFILE_FIELDS[id].icon}
            title={PROFILE_FIELDS[id].title}
            subtitle={saved[id] || 'Not set'}
            subtitleOneLine
            onPress={() => open(id)}
          />
        ))}
      </View>

      <Sheet
        testID="profile-edit"
        visible={visible}
        title={spec.title}
        subtitle={
          field === 'goal'
            ? 'Say who you message, what you want to happen with them, and how you want to come across. Tune my tones rewrites Banter’s tones from this.'
            : undefined
        }
        onClose={() => setVisible(false)}>
        <TextField
          testID={spec.testID}
          label={spec.label}
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            setError(null);
          }}
          error={error ?? undefined}
          helper={
            field === 'goal'
              ? words >= GOAL_MIN_WORDS
                ? `${words} words. Enough to tune your tones.`
                : `${words} of at least ${GOAL_MIN_WORDS} words needed to tune your tones.`
              : spec.input.helper
          }
          editable={!busy}
          {...spec.input}
        />
        <View style={styles.row}>
          <Button
            testID="profile-cancel"
            style={styles.fill}
            variant="secondary"
            label="Cancel"
            onPress={() => setVisible(false)}
            disabled={busy}
          />
          <Button testID="profile-save" style={styles.fill} label="Save" onPress={submit} loading={busy} />
        </View>
      </Sheet>

      <Dialog
        visible={askingReset}
        title="Reset Banter's tones?"
        message={`Your changes to ${edited === 1 ? '1 of Banter’s tones' : `${edited} of Banter’s tones`} go, and they read as Banter wrote them again. Tones you made yourself stay as they are.`}
        confirmLabel="Reset"
        busy={resetting}
        onConfirm={reset}
        onCancel={() => setAskingReset(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
});
