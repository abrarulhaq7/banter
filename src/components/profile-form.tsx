import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, TextField } from '@/components/ui';
import {
  fieldsFromProfile,
  patchFromFields,
  useProfile,
  validateProfile,
  type ProfileFields,
} from '@/data';
import { spacing } from '@/theme';

type ProfileFormProps = {
  submitLabel: string;
  /** Called after the profile has been saved. */
  onSaved: () => void;
};

/** The "about you" fields. Used in onboarding and when editing the profile later. */
export function ProfileForm({ submitLabel, onSaved }: ProfileFormProps) {
  const { profile, save } = useProfile();
  const [fields, setFields] = useState<ProfileFields>(() => fieldsFromProfile(profile));
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const errors = validateProfile(fields);
  const set = (field: keyof ProfileFields) => (value: string) =>
    setFields((previous) => ({ ...previous, [field]: value }));
  const errorFor = (field: keyof ProfileFields) => (showErrors ? errors[field] : undefined);

  const submit = async () => {
    setFormError(null);
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    const result = await save(patchFromFields(fields));
    setBusy(false);
    if (result.ok) onSaved();
    else setFormError(result.message);
  };

  return (
    <View style={styles.form}>
      <TextField
        testID="profile-name"
        label="Name"
        placeholder="What people call you"
        value={fields.name}
        onChangeText={set('name')}
        error={errorFor('name')}
        autoCapitalize="words"
        textContentType="none"
        autoComplete="off"
      />
      <TextField
        testID="profile-age"
        label="Age (optional)"
        placeholder="18 or older"
        value={fields.age}
        onChangeText={set('age')}
        error={errorFor('age')}
        keyboardType="number-pad"
        maxLength={3}
      />
      <TextField
        testID="profile-city"
        label="City (optional)"
        placeholder="Where you live"
        value={fields.city}
        onChangeText={set('city')}
        error={errorFor('city')}
        autoCapitalize="words"
      />
      <TextField
        testID="profile-work"
        label="Work or study (optional)"
        placeholder="What you do"
        value={fields.work}
        onChangeText={set('work')}
        error={errorFor('work')}
      />
      <TextField
        testID="profile-interests"
        label="Interests (optional)"
        placeholder="Football, cooking, old films, hiking"
        value={fields.interests}
        onChangeText={set('interests')}
        error={errorFor('interests')}
        multiline
      />
      <TextField
        testID="profile-texting-style"
        label="How you text (optional)"
        placeholder="Short, lowercase, a bit dry, few emoji"
        helper="In your own words. Banter uses this to make lines sound like you."
        value={fields.textingStyle}
        onChangeText={set('textingStyle')}
        error={errorFor('textingStyle')}
        multiline
      />

      {formError ? (
        <AppText testID="profile-error" color="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}
      <Button testID="profile-submit" label={submitLabel} onPress={submit} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
});
