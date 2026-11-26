import type { ReactNode } from 'react';
import { useState } from 'react';

import { Banner, Button, Screen, ScreenHeader, TextField } from '@/components/ui';
import { fieldsFromProfile, patchFromFields, useProfile, validateProfile, type ProfileFields } from '@/data';

import { PROFILE_FIELDS, type ProfileFieldId } from './profile-fields';

type ProfileStepScreenProps = {
  testID: string;
  title: string;
  subtitle?: string;
  /** The facts this step asks for. The others are kept as they are. */
  fields: readonly ProfileFieldId[];
  submitLabel: string;
  onBack?: () => void;
  /** Top right of the header: the way out of onboarding. */
  headerRight?: ReactNode;
  /** Called after the step has been saved. */
  onSaved: () => void;
};

/** One step of the "about you" questions in onboarding: a few fields and a pinned Continue. */
export function ProfileStepScreen({
  testID,
  title,
  subtitle,
  fields: shown,
  submitLabel,
  onBack,
  headerRight,
  onSaved,
}: ProfileStepScreenProps) {
  const { profile, save } = useProfile();
  const [fields, setFields] = useState<ProfileFields>(() => fieldsFromProfile(profile));
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const errors = validateProfile(fields);
  const blocked = shown.some((field) => errors[field]);

  const submit = async () => {
    setFormError(null);
    setShowErrors(true);
    if (blocked) return;

    // Only this step's answers are taken from the form; the rest stay as they are saved.
    const next = fieldsFromProfile(profile);
    for (const field of shown) next[field] = fields[field];

    setBusy(true);
    const result = await save(patchFromFields(next));
    setBusy(false);
    if (result.ok) onSaved();
    else setFormError(result.message);
  };

  return (
    <Screen
      testID={testID}
      fill
      footer={<Button testID="profile-submit" label={submitLabel} onPress={submit} loading={busy} />}>
      <ScreenHeader title={title} subtitle={subtitle} onBack={onBack} right={headerRight} />

      {shown.map((field) => {
        const spec = PROFILE_FIELDS[field];
        return (
          <TextField
            key={field}
            testID={spec.testID}
            label={spec.label}
            value={fields[field]}
            onChangeText={(value) => setFields((previous) => ({ ...previous, [field]: value }))}
            error={showErrors ? errors[field] : undefined}
            editable={!busy}
            {...spec.input}
          />
        );
      })}

      {formError ? (
        <Banner tone="danger" messageTestID="profile-error">
          {formError}
        </Banner>
      ) : null}
    </Screen>
  );
}
