import { useRouter } from 'expo-router';

import { AddKeyScreen } from '@/components/keys/add-key-screen';

/** Settings > AI keys > Add a key. */
export default function AddKeyRoute() {
  const router = useRouter();
  // After the first key there is a list to go back to; before it, the list is the next stop.
  const done = () => (router.canGoBack() ? router.back() : router.replace('/keys'));
  return <AddKeyScreen testID="add-key-screen" title="Add a key" onBack={() => router.back()} onSaved={done} />;
}
