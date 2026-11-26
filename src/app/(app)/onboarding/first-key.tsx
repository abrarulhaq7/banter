import { useRouter } from 'expo-router';
import { useState } from 'react';

import { KeyForm } from '@/components/key-form';
import { AppText, Button, Screen, ScreenHeader } from '@/components/ui';
import { useProfile } from '@/data';

/** Onboarding, step 2 of 2: the first API key. Finishing either way opens the app. */
export default function OnboardingFirstKeyScreen() {
  const router = useRouter();
  const { save } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Marking the profile as onboarded flips the guard in the layout, which shows the app.
  const finish = async () => {
    setError(null);
    setBusy(true);
    const result = await save({ onboarded_at: new Date().toISOString() });
    setBusy(false);
    if (!result.ok) setError(result.message);
  };

  return (
    <Screen testID="onboarding-key-screen">
      <ScreenHeader
        title="Your AI key"
        subtitle="Step 2 of 2. Banter uses your own key from Gemini, OpenAI or Claude, so you pay only for what you use."
        onBack={() => router.back()}
      />
      <KeyForm onSaved={finish} />
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button testID="skip-key" variant="ghost" label="Add a key later" onPress={finish} loading={busy} />
    </Screen>
  );
}
