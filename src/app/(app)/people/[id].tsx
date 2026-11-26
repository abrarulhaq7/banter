import { useLocalSearchParams } from 'expo-router';

import { PersonScreen } from '@/components/people/person-screen';

export default function PersonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PersonScreen id={id} />;
}
