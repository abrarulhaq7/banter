import { useRouter } from 'expo-router';

import { ProfileForm } from '@/components/profile-form';
import { Button, Screen, ScreenHeader } from '@/components/ui';
import { useSignOut } from '@/hooks/use-sign-out';

/** Onboarding, step 1 of 2: who you are. */
export default function OnboardingAboutScreen() {
  const router = useRouter();
  const signOut = useSignOut();
  return (
    <Screen testID="onboarding-about-screen">
      <ScreenHeader
        title="About you"
        subtitle="Step 1 of 2. A few facts help Banter write lines that sound like you. Only your name is needed."
      />
      <ProfileForm submitLabel="Continue" onSaved={() => router.push('/onboarding/first-key')} />
      {/* The way out for someone who signed in with the wrong account. */}
      <Button testID="sign-out-button" variant="ghost" label="Sign out" onPress={signOut} />
    </Screen>
  );
}
