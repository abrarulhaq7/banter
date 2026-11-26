import { useLocalSearchParams } from 'expo-router';

import { KeyScreen } from '@/components/keys/key-screen';

/** Settings > AI keys > one key. */
export default function KeyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <KeyScreen id={id} />;
}
