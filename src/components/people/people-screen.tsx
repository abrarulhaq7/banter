import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Banner,
  EmptyState,
  ListRow,
  Screen,
  ScreenHeader,
  SegmentedControl,
  TextField,
} from '@/components/ui';
import { useHistory } from '@/history';
import { CONTEXT_LABELS, timeAgo } from '@/history/labels';
import { spacing } from '@/theme';

import { SavedLines } from './saved-lines';

type View_ = 'people' | 'saved';
const VIEWS: { value: View_; label: string }[] = [
  { value: 'people', label: 'People' },
  { value: 'saved', label: 'Saved' },
];

/** From this many people on, the list gets a search field. */
const SEARCH_FROM = 8;

type PeopleScreenProps = {
  /** Tests replace the clipboard used by Saved. */
  copy?: (text: string) => Promise<unknown>;
};

/**
 * The People tab: everyone the user has used Banter with, most recent first. The switch
 * at the top shows Saved instead: every line the user saved, for anyone.
 */
export function PeopleScreen({ copy }: PeopleScreenProps = {}) {
  const router = useRouter();
  const { people, peopleStatus, loadError, waiting } = useHistory();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View_>('people');

  const wanted = query.trim().toLowerCase().replace(/^@/, '');
  const shown = wanted ? people.filter((person) => person.username.includes(wanted)) : people;

  return (
    <Screen testID="people-screen" edges={['top', 'left', 'right']} contentStyle={styles.content}>
      <ScreenHeader title="People" />
      <SegmentedControl testIDPrefix="people-view" options={VIEWS} value={view} onChange={setView} />

      {loadError ? (
        <Banner tone="info" title="Showing the copy saved on this phone">
          {loadError}
        </Banner>
      ) : null}
      {waiting > 0 ? (
        <Banner testID="history-waiting" tone="info">
          {`${waiting === 1 ? '1 change is' : `${waiting} changes are`} waiting to be saved. Banter will try again by itself.`}
        </Banner>
      ) : null}

      {view === 'saved' ? (
        <SavedLines copy={copy} />
      ) : (
        <>
          {people.length >= SEARCH_FROM ? (
            <TextField
              testID="people-search"
              label="Search"
              placeholder="username"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          ) : null}

          {peopleStatus === 'ready' && people.length === 0 ? (
            <EmptyState
              testID="no-people"
              icon="people"
              title="Nobody yet"
              message="Get lines for a screenshot and she will appear here, with everything Banter wrote for her."
              action={{
                testID: 'no-people-action',
                icon: 'generate',
                label: 'Get lines',
                onPress: () => router.push('/'),
              }}
            />
          ) : null}
          {people.length > 0 && shown.length === 0 ? (
            <AppText testID="no-match" color="textMuted">
              Nobody matches “{query.trim()}”.
            </AppText>
          ) : null}

          <View style={styles.list}>
            {shown.map((person, index) => (
              <ListRow
                key={person.id}
                testID={`person-card-${index}`}
                leading={<Avatar name={person.username} />}
                title={`@${person.username}`}
                subtitle={[person.context ? CONTEXT_LABELS[person.context] : null, timeAgo(person.last_interaction_at)]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() =>
                  router.push({
                    pathname: '/people/[id]',
                    params: { id: person.id },
                  })
                }
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  list: { gap: spacing.sm },
});
