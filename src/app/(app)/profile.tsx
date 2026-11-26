import { useRouter } from 'expo-router';

import { ProfileForm } from '@/components/profile-form';
import { Screen, ScreenHeader } from '@/components/ui';

export default function ProfileScreen() {
  const router = useRouter();
  return (
    <Screen testID="profile-screen">
      <ScreenHeader
        title="About you"
        subtitle="Banter uses these facts, when they help, to make lines sound like you."
        onBack={() => router.back()}
      />
      <ProfileForm submitLabel="Save" onSaved={() => router.back()} />
    </Screen>
  );
}
