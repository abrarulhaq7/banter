import { useLocalSearchParams } from 'expo-router';

import { GuideEntryScreen } from '@/components/guide/guide-entry-screen';

/** Guide > one setup or one kind of option. */
export default function GuideEntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GuideEntryScreen id={id} />;
}
