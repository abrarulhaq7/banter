import { useRouter } from 'expo-router';

import { KeyForm } from '@/components/key-form';
import { Screen, ScreenHeader } from '@/components/ui';

export default function AddKeyScreen() {
  const router = useRouter();
  // After the first key there is a list to go back to; before it, the list is the next stop.
  const done = () => (router.canGoBack() ? router.back() : router.replace('/keys'));
  return (
    <Screen testID="add-key-screen">
      <ScreenHeader title="Add a key" onBack={() => router.back()} />
      <KeyForm onSaved={done} />
    </Screen>
  );
}
