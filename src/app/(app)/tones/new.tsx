import { useLocalSearchParams } from 'expo-router';

import { ToneScreen } from '@/components/tones/tone-screen';

/** My tones > Add a tone. Learn from an example opens it filled in. */
export default function NewToneRoute() {
  const { label, definition } = useLocalSearchParams<{ label?: string; definition?: string }>();
  return <ToneScreen draft={{ label, definition }} />;
}
