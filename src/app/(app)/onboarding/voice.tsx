import { useRouter } from 'expo-router';

import { VOICE_FIELDS } from '@/components/profile/profile-fields';
import { ProfileStepScreen } from '@/components/profile/profile-step-screen';

/** Onboarding, step 2 of 3: what you like and how you text. Both can be left empty. */
export default function OnboardingVoiceRoute() {
  const router = useRouter();
  return (
    <ProfileStepScreen
      testID="onboarding-voice-screen"
      title="How you sound"
      subtitle="Step 2 of 3. Optional, but it is what makes lines sound like you."
      fields={VOICE_FIELDS}
      submitLabel="Continue"
      onBack={() => router.back()}
      onSaved={() => router.push('/onboarding/first-key')}
    />
  );
}
