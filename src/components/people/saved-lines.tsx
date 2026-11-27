import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LineCard } from '@/components/generate/line-card';
import { Banner, EmptyState, useToast } from '@/components/ui';
import { dataErrorMessage } from '@/data';
import { useHistory, type SavedLine } from '@/history';
import { timeAgo } from '@/history/labels';
import { haptics } from '@/lib/haptics';
import { spacing, useTheme } from '@/theme';

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; lines: SavedLine[] };

type SavedLinesProps = {
  /** Tests replace the clipboard. */
  copy?: (text: string) => Promise<unknown>;
};

/**
 * People > Saved: every line the user saved, for anyone, most recently saved first. Tap a
 * line to copy it; the bookmark takes it out of Saved. Read again each time it is opened.
 */
export function SavedLines({ copy = (text) => Clipboard.setStringAsync(text) }: SavedLinesProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const history = useHistory();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async (isCurrent: () => boolean = () => true) => {
    try {
      const lines = await history.savedLines();
      if (isCurrent()) setState({ status: 'ready', lines });
    } catch (error) {
      if (isCurrent()) setState({ status: 'error', message: dataErrorMessage(error, 'load your saved lines') });
    }
  };

  // Every time the tab is opened again: a line saved on Results a moment ago shows.
  useFocusEffect(
    useCallback(() => {
      let current = true;
      void (async () => {
        await load(() => current);
      })();
      return () => {
        current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const copyLine = async (line: SavedLine) => {
    await copy(line.text);
    haptics.tap();
    setCopiedId(line.id);
    toast.show('Copied');
    void history.save({ kind: 'linePatch', lineId: line.id, patch: { copied_at: new Date().toISOString() } });
  };

  const unsave = (line: SavedLine) => {
    if (state.status !== 'ready') return;
    setState({ status: 'ready', lines: state.lines.filter((item) => item.id !== line.id) });
    toast.show('Removed from saved', 'info');
    void history.save({ kind: 'linePatch', lineId: line.id, patch: { kept_at: null } });
  };

  if (state.status === 'loading') {
    return <ActivityIndicator testID="saved-loading" color={colors.accent} />;
  }
  if (state.status === 'error') {
    return (
      <Banner
        testID="saved-error"
        tone="danger"
        action={{
          label: 'Try again',
          onPress: () => {
            setState({ status: 'loading' });
            void load();
          },
        }}>
        {state.message}
      </Banner>
    );
  }
  if (state.lines.length === 0) {
    return (
      <EmptyState
        testID="saved-empty"
        icon="keep"
        title="Nothing saved yet"
        message="Tap the bookmark on a line you like. Every line you save, for anyone, lands here."
      />
    );
  }

  return (
    <View testID="saved-list" style={styles.list}>
      {state.lines.map((line, index) => (
        <LineCard
          key={line.id}
          testKey={`saved-${index}`}
          text={line.text}
          caption={[line.username ? `@${line.username}` : 'Username not read', line.toneLabel, timeAgo(line.keptAt)]
            .filter(Boolean)
            .join(' · ')}
          copied={copiedId === line.id}
          kept
          onCopy={() => void copyLine(line)}
          onToggleKeep={() => unsave(line)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
