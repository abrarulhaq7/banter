import { useLocalSearchParams } from 'expo-router';

import { ShotScreen } from '@/components/people/shot-screen';

export default function ShotRoute() {
  const { id, shot } = useLocalSearchParams<{ id: string; shot: string }>();
  return <ShotScreen personId={id} shotId={shot} />;
}
