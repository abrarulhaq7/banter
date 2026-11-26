import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Banner, Icon, ListRow, Screen, ScreenHeader, TextField } from '@/components/ui';
import { useHistory } from '@/history';
import { CONTEXT_LABELS, timeAgo } from '@/history/labels';
import { spacing } from '@/theme';

/** From this many people on, the list gets a search field. */
const SEARCH_FROM = 8;

/** The People tab: everyone the user has used Banter with, most recent first. */
export function PeopleScreen() {
  const router = useRouter();
  const { people, peopleStatus, loadError, waiting } = useHistory();
  const [query, setQuery] = useState('');

  const wanted = query.trim().toLowerCase().replace(/^@/, '');
  const shown = wanted ? people.filter((person) => person.username.includes(wanted)) : people;

  return (
    <Screen testID="people-screen" edges={['top', 'left', 'right']} contentStyle={styles.content}>
      <ScreenHeader title="People" />

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
        <View testID="no-people" style={styles.empty}>
          <Icon name="people" size={40} color="accent" />
          <AppText color="textMuted" style={styles.centerText}>
            Nobody yet. Get lines for a screenshot and she will appear here.
          </AppText>
        </View>
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
            onPress={() => router.push({ pathname: '/people/[id]', params: { id: person.id } })}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  list: { gap: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  centerText: { textAlign: 'center' },
});
