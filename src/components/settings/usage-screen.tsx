import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Card,
  EmptyState,
  ListRow,
  Screen,
  ScreenHeader,
  SegmentedControl,
} from '@/components/ui';
import { dataErrorMessage, useKeys } from '@/data';
import { useHistory } from '@/history';
import type { UsageRow } from '@/lib/database.types';
import { PROVIDERS } from '@/providers/providers';
import { spacing, useTheme } from '@/theme';

type Period = 'month' | 'all';
type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: UsageRow[] };

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

/** Settings > Your data > Usage: how many generations each key has made, on which model. */
export function UsageScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const history = useHistory();
  const { models } = useKeys();
  const [period, setPeriod] = useState<Period>('month');
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = async (isCurrent: () => boolean = () => true) => {
    try {
      const rows = await history.usage();
      if (isCurrent()) setState({ status: 'ready', rows });
    } catch (error) {
      if (isCurrent()) setState({ status: 'error', message: dataErrorMessage(error, 'load your usage') });
    }
  };

  useEffect(() => {
    let current = true;
    void (async () => {
      await load(() => current);
    })();
    return () => {
      current = false;
    };
    // Loads once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = (row: UsageRow) => (period === 'month' ? row.this_month : row.generations);
  const rows = state.status === 'ready' ? state.rows.filter((row) => count(row) > 0).sort((a, b) => count(b) - count(a)) : [];
  const total = rows.reduce((sum, row) => sum + count(row), 0);
  const everUsed = state.status === 'ready' && state.rows.length > 0;
  const modelLabel = (row: UsageRow) =>
    models.find((model) => model.provider === row.provider && model.model_id === row.model)?.label ?? row.model;

  return (
    <Screen testID="usage-screen">
      <ScreenHeader title="Usage" subtitle="How many generations each of your keys has made." onBack={() => router.back()} />

      {state.status === 'loading' ? (
        <View testID="usage-loading" style={styles.row}>
          <ActivityIndicator color={colors.accent} />
          <AppText color="textMuted">Counting…</AppText>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <Banner
          tone="danger"
          messageTestID="usage-error"
          action={{
            label: 'Try again',
            onPress: () => {
              setState({ status: 'loading' });
              void load();
            },
          }}>
          {state.message}
        </Banner>
      ) : null}

      {state.status === 'ready' && !everUsed ? (
        <EmptyState
          testID="usage-empty"
          icon="usage"
          title="Nothing counted yet"
          message="Each set of lines you get is counted here, per key and model."
        />
      ) : null}

      {everUsed ? (
        <>
          <SegmentedControl testIDPrefix="usage" options={PERIODS} value={period} onChange={setPeriod} />

          <Card variant="tinted" testID="usage-total">
            <AppText testID="usage-total-number" variant="display">
              {total}
            </AppText>
            <AppText color="textMuted">
              {total === 1 ? 'generation' : 'generations'} {period === 'month' ? 'this month' : 'in all'}
            </AppText>
          </Card>

          {rows.length === 0 ? (
            <AppText testID="usage-none-this-month" color="textMuted">
              Nothing this month yet.
            </AppText>
          ) : null}

          <View style={styles.list}>
            {rows.map((row, index) => (
              <ListRow
                key={`${row.provider}|${row.model}|${row.key_label ?? ''}`}
                testID={`usage-row-${index}`}
                icon="key"
                title={row.key_label ?? 'Unnamed key'}
                subtitle={`${PROVIDERS[row.provider].label} · ${modelLabel(row)}`}
                value={String(count(row))}
              />
            ))}
          </View>

          <AppText variant="caption" color="textMuted">
            A generation is one answer from the AI: a set of lines, or one analysis. For what it cost,
            see your provider&apos;s own dashboard.
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  list: { gap: spacing.sm },
});
