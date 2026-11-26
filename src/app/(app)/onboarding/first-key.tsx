import { useRouter } from 'expo-router';
import { useState } from 'react';

import { AddKeyScreen } from '@/components/keys/add-key-screen';
import { useProfile } from '@/data';

/** Onboarding, step 3 of 3: the first API key. Finishing either way opens the app. */
export default function OnboardingFirstKeyRoute() {
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
    <AddKeyScreen
      testID="onboarding-key-screen"
      title="Your AI key"
      subtitle="Step 3 of 3. Banter uses your own key from Gemini, OpenAI or Claude, so you pay only for what you use."
      onBack={() => router.back()}
      onSaved={finish}
      error={error}
      secondary={{ testID: 'skip-key', label: 'Add a key later', onPress: finish, loading: busy }}
    />
  );
}
