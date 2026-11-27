import { useLocalSearchParams } from 'expo-router';

import { ToneScreen } from '@/components/tones/tone-screen';

/** My tones > one tone. Learn from an example can open it with a style to add. */
export default function ToneRoute() {
  const { key, append } = useLocalSearchParams<{ key: string; append?: string }>();
  return <ToneScreen toneKey={key} append={append} />;
}
