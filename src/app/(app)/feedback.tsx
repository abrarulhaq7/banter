import { useLocalSearchParams } from 'expo-router';

import { FeedbackScreen } from '@/components/feedback/feedback-screen';

/** Report a problem or send an idea. From Results, with the set of lines it is about. */
export default function FeedbackRoute() {
  const { setId } = useLocalSearchParams<{ setId?: string }>();
  return <FeedbackScreen setId={setId} />;
}
