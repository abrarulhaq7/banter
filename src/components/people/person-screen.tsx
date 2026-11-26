import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, Screen, ScreenHeader } from '@/components/ui';
import { dataErrorMessage } from '@/data';
import { DEFAULT_MODES, type ModeId } from '@/engine';
import { useHistory, type InteractionWithLines } from '@/history';
import { CONTEXT_LABELS, timeAgo } from '@/history/labels';
import type { ContextId, LineResult, LineRow } from '@/lib/database.types';
import { radius, spacing, useTheme } from '@/theme';

const CONTEXTS = Object.keys(CONTEXT_LABELS) as ContextId[];
const ADJUSTMENT = { new_lines: 'New lines', shorter: 'Shorter', bolder: 'Bolder' } as const;

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: InteractionWithLines[] };

/** One person: every screenshot, the lines for it, which were used and how it went. */
export function PersonScreen({ id }: { id: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const history = useHistory();
  const person = history.people.find((item) => item.id === id);

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [screenshots, setScreenshots] = useState<Record<string, string>>({});
  /** Results marked here, shown at once while the save goes through. */
  const [marked, setMarked] = useState<Record<string, LineResult | null>>({});
  /** A choice made here, shown at once. Until then the saved one is shown, whenever it arrives. */
  const [chosenContext, setChosenContext] = useState<ContextId | null>(null);
  const context = chosenContext ?? person?.context ?? null;

  const load = async (isCurrent: () => boolean = () => true) => {
    try {
      const items = await history.listInteractions(id);
      if (!isCurrent()) return;
      setLoaded({ status: 'ready', items });

      // One stored file can serve several sets from the same screenshot.
      const paths = [...new Set(items.map((item) => item.screenshot_path).filter((path): path is string => !!path))];
      const links = await Promise.all(paths.map(async (path) => [path, await history.screenshotUrl(path)] as const));
      if (!isCurrent()) return;
      setScreenshots(Object.fromEntries(links.filter((link): link is readonly [string, string] => !!link[1])));
    } catch (error) {
      if (isCurrent()) setLoaded({ status: 'error', message: dataErrorMessage(error, 'load this history') });
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
    // Loads once for this person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const mark = (line: LineRow, result: LineResult) => {
    const current = line.id in marked ? marked[line.id] : line.result;
    // Tapping the chosen result again clears it.
    const next = current === result ? null : result;
    setMarked((previous) => ({ ...previous, [line.id]: next }));
    void history.save({
      kind: 'linePatch',
      lineId: line.id,
      patch: { result: next, result_at: next ? new Date().toISOString() : null },
    });
  };

  const chooseContext = (next: ContextId) => {
    if (!person || next === context) return;
    setChosenContext(next);
    void history.save({ kind: 'personContext', username: person.username, context: next });
  };

  if (!person) {
    return (
      <Screen testID="person-screen">
        <ScreenHeader title="Person not found" subtitle="She may have been removed." onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen testID="person-screen">
      <ScreenHeader title={`@${person.username}`} onBack={() => router.back()} />

      <View style={styles.group}>
        <AppText variant="label" color="textMuted">
          How you know her
        </AppText>
        <View style={styles.chips}>
          {CONTEXTS.map((item) => (
            <Chip
              key={item}
              testID={`person-context-${item}`}
              label={CONTEXT_LABELS[item]}
              selected={item === context}
              onPress={() => chooseContext(item)}
            />
          ))}
        </View>
      </View>

      {loaded.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
      {loaded.status === 'error' ? (
        <Card testID="timeline-error">
          <AppText color="danger" accessibilityRole="alert">
            {loaded.message}
          </AppText>
          <Button
            variant="ghost"
            size="sm"
            label="Try again"
            style={styles.inline}
            onPress={() => {
              setLoaded({ status: 'loading' });
              void load();
            }}
          />
        </Card>
      ) : null}
      {loaded.status === 'ready' && loaded.items.length === 0 ? (
        <AppText testID="timeline-empty" color="textMuted">
          Nothing saved for her yet.
        </AppText>
      ) : null}

      {loaded.status === 'ready'
        ? loaded.items.map((item, index) => {
            const heading = [
              item.tone_label,
              DEFAULT_MODES[item.mode_id as ModeId]?.label ?? item.mode_id,
              item.adjustment ? ADJUSTMENT[item.adjustment] : null,
            ]
              .filter(Boolean)
              .join(' · ');
            const analysis = item.analysis as { advice?: string; declined?: string } | null;
            // Show the screenshot once, on the first (oldest) set made from it.
            const previous = loaded.items[index + 1];
            const showScreenshot =
              item.screenshot_path && previous?.screenshot_path !== item.screenshot_path
                ? screenshots[item.screenshot_path]
                : undefined;

            return (
              <View key={item.id} testID={`timeline-item-${index}`} style={styles.group}>
                <View style={styles.header}>
                  <AppText testID={`timeline-heading-${index}`} variant="heading" accessibilityRole="header">
                    {heading}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {timeAgo(item.created_at)}
                  </AppText>
                </View>

                {showScreenshot ? (
                  <Image
                    testID={`timeline-screenshot-${index}`}
                    source={{ uri: showScreenshot }}
                    resizeMode="contain"
                    accessibilityLabel="The screenshot these lines were written for"
                    style={[styles.screenshot, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  />
                ) : null}

                {item.noticed ? (
                  <AppText variant="caption" color="textMuted">
                    Noticed: {item.noticed}
                  </AppText>
                ) : null}
                {analysis?.advice ? <AppText>{analysis.advice}</AppText> : null}
                {analysis?.declined ? <AppText color="accentAlt">No lines: {analysis.declined}</AppText> : null}

                {item.lines.map((line, position) => {
                  const result = line.id in marked ? marked[line.id] : line.result;
                  const used = line.copied_at !== null;
                  return (
                    <Card key={line.id} testID={`timeline-line-${index}-${position}`} selected={used}>
                      <AppText>{line.text}</AppText>
                      <AppText
                        testID={`timeline-line-state-${index}-${position}`}
                        variant="caption"
                        color={used ? 'success' : 'textMuted'}>
                        {[used ? 'Copied' : 'Not used', line.kept_at ? 'Kept' : null].filter(Boolean).join(' · ')}
                      </AppText>
                      {used ? (
                        <View style={styles.chips}>
                          <Chip
                            testID={`replied-${index}-${position}`}
                            label="Replied"
                            selected={result === 'replied'}
                            onPress={() => mark(line, 'replied')}
                          />
                          <Chip
                            testID={`no-reply-${index}-${position}`}
                            label="No reply"
                            selected={result === 'no_reply'}
                            onPress={() => mark(line, 'no_reply')}
                          />
                        </View>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            );
          })
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inline: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  screenshot: { height: 220, borderRadius: radius.lg, borderWidth: 1 },
});
