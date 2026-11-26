import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ListRow, Screen, ScreenHeader, Sheet, TextField, useToast } from '@/components/ui';
import { fieldsFromProfile, patchFromFields, useProfile, validateProfile } from '@/data';
import { spacing } from '@/theme';

import { ALL_FIELDS, PROFILE_FIELDS, type ProfileFieldId } from './profile-fields';

/** Settings > About you: one row per fact, showing what is saved. A row opens a sheet to change it. */
export function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, save } = useProfile();
  const saved = fieldsFromProfile(profile);

  // The field stays set while the sheet slides away, so its title does not blank out.
  const [field, setField] = useState<ProfileFieldId>('name');
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (next: ProfileFieldId) => {
    setDraft(saved[next]);
    setError(null);
    setField(next);
    setVisible(true);
  };

  const submit = async () => {
    const next = { ...saved, [field]: draft };
    const problem = validateProfile(next)[field];
    if (problem) return setError(problem);

    setBusy(true);
    const result = await save(patchFromFields(next));
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setVisible(false);
    toast.show('Saved');
  };

  const spec = PROFILE_FIELDS[field];

  return (
    <Screen testID="profile-screen" fill>
      <ScreenHeader
        title="About you"
        subtitle="Banter uses these, when they help, to make lines sound like you."
        onBack={() => router.back()}
      />

      <View style={styles.list}>
        {ALL_FIELDS.map((id) => (
          <ListRow
            key={id}
            testID={`profile-row-${id}`}
            icon={PROFILE_FIELDS[id].icon}
            title={PROFILE_FIELDS[id].title}
            subtitle={saved[id] || 'Not set'}
            onPress={() => open(id)}
          />
        ))}
      </View>

      <Sheet
        testID="profile-edit"
        visible={visible}
        title={spec.title}
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
          editable={!busy}
          {...spec.input}
        />
        <View style={styles.sheetActions}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  sheetActions: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
});
