import { useRouter } from 'expo-router';

import { FACT_FIELDS } from '@/components/profile/profile-fields';
import { ProfileStepScreen } from '@/components/profile/profile-step-screen';
import { Button } from '@/components/ui';
import { useSignOut } from '@/hooks/use-sign-out';

/** Onboarding, step 1 of 3: who you are. */
export default function OnboardingAboutRoute() {
  const router = useRouter();
  const signOut = useSignOut();
  return (
    <ProfileStepScreen
      testID="onboarding-about-screen"
      title="About you"
      subtitle="Step 1 of 3. Only your name is needed."
      fields={FACT_FIELDS}
      submitLabel="Continue"
      // The way out for someone who signed in with the wrong account.
      headerRight={<Button testID="sign-out-button" variant="ghost" size="sm" label="Sign out" onPress={signOut} />}
      onSaved={() => router.push('/onboarding/voice')}
    />
  );
}
