import { useLocalSearchParams } from 'expo-router';

import { ToneScreen } from '@/components/tones/tone-screen';

/** My tones > one tone. */
export default function ToneRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return <ToneScreen toneKey={key} />;
}
