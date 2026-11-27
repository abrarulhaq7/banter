import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, ListRow, Screen, ScreenHeader } from '@/components/ui';
import { spacing } from '@/theme';

import { GUIDE_SETUPS, GUIDE_TOPICS } from './guide-content';

/**
 * Generate > Guide: the best setups for common situations first, then what each option
 * does. A list of short rows; each opens its own page.
 */
export function GuideScreen() {
  const router = useRouter();
  const open = (id: string) => router.push({ pathname: '/guide/[id]', params: { id } });

  return (
    <Screen testID="guide-screen">
      <ScreenHeader title="Guide" subtitle="The best setups, and what each option does." onBack={() => router.back()} />

      <View style={styles.section}>
        <AppText variant="label" color="textMuted" accessibilityRole="header">
          Best setups
        </AppText>
        {GUIDE_SETUPS.map((setup) => (
          <ListRow
            key={setup.id}
            testID={`guide-setup-${setup.id}`}
            icon={setup.icon}
            title={setup.title}
            subtitle={setup.choose.join(' · ')}
            onPress={() => open(setup.id)}
          />
        ))}
      </View>

      <View style={styles.section}>
        <AppText variant="label" color="textMuted" accessibilityRole="header">
          What each option does
        </AppText>
        {GUIDE_TOPICS.map((topic) => (
          <ListRow
            key={topic.id}
            testID={`guide-topic-${topic.id}`}
            icon={topic.icon}
            title={topic.title}
            subtitle={topic.subtitle}
            onPress={() => open(topic.id)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
