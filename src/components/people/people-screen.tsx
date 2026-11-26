import { useRouter } from 'expo-router';

import { AppText, Card, Screen, ScreenHeader } from '@/components/ui';
import { CONTEXT_LABELS, timeAgo } from '@/history/labels';
import { useHistory } from '@/history';

/** Everyone the user has used Banter with, most recent first. */
export function PeopleScreen() {
  const router = useRouter();
  const { people, peopleStatus, loadError, waiting } = useHistory();

  return (
    <Screen testID="people-screen">
      <ScreenHeader
        title="People"
        subtitle="Everyone you have used Banter with. Tap someone to see what you sent."
        onBack={() => router.back()}
      />

      {loadError ? (
        <AppText variant="caption" color="accentAlt">
          Showing the copy saved on this phone. {loadError}
        </AppText>
      ) : null}
      {waiting > 0 ? (
        <AppText testID="history-waiting" variant="caption" color="accentAlt">
          {waiting === 1 ? '1 change is' : `${waiting} changes are`} waiting to be saved. Banter will try
          again by itself.
        </AppText>
      ) : null}

      {peopleStatus === 'ready' && people.length === 0 ? (
        <AppText testID="no-people" color="textMuted">
          Nobody yet. Get lines for a screenshot and she will appear here.
        </AppText>
      ) : null}

      {people.map((person, index) => (
        <Card
          key={person.id}
          testID={`person-card-${index}`}
          accessibilityLabel={`@${person.username}`}
          onPress={() => router.push({ pathname: '/people/[id]', params: { id: person.id } })}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            @{person.username}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {[person.context ? CONTEXT_LABELS[person.context] : null, timeAgo(person.last_interaction_at)]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}
