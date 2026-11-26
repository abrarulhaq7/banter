import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Card } from '@/components/ui';
import type { Interest } from '@/engine';
import { setHeading, setLabel, type KeptLine, type ResultSet } from '@/generate/session';
import { spacing, type ColorRole } from '@/theme';

import { LineCard } from './line-card';

type ResultSetViewProps = {
  set: ResultSet;
  copiedLineId: string | null;
  keptIds: ReadonlySet<string>;
  onCopy: (lineId: string, text: string) => void;
  onToggleKeep: (line: KeptLine) => void;
};

const INTEREST: Record<Interest, { label: string; color: ColorRole }> = {
  high: { label: 'She seems interested', color: 'success' },
  medium: { label: 'Some interest', color: 'warning' },
  low: { label: 'Not much interest', color: 'danger' },
  unclear: { label: 'Hard to tell', color: 'textMuted' },
};

/**
 * The set on screen: its label, what was noticed, and the lines or the analysis.
 * Only one set is shown at a time, so the test ids carry no set number: `result-heading-0`,
 * `line-0-<position>` always mean the set being looked at.
 */
export function ResultSetView({ set, copiedLineId, keptIds, onCopy, onToggleKeep }: ResultSetViewProps) {
  const { output } = set;
  const label = setLabel(set);

  /** `position` names the line in test ids; `id` is the saved line's id. */
  const line = (position: string, id: string, text: string, caption?: string) => {
    return (
      <LineCard
        key={id}
        testKey={`0-${position}`}
        text={text}
        caption={caption}
        copied={copiedLineId === id}
        kept={keptIds.has(id)}
        onCopy={() => onCopy(id, text)}
        onToggleKeep={() => onToggleKeep({ id, text, label })}
      />
    );
  };

  return (
    <View testID="result-set-0" style={styles.set}>
      <View style={styles.header}>
        <AppText testID="result-heading-0" variant="heading" accessibilityRole="header">
          {setHeading(set)}
        </AppText>
        {output.noticed ? (
          <AppText testID="result-noticed-0" variant="caption" color="textMuted" numberOfLines={3}>
            Noticed: {output.noticed}
          </AppText>
        ) : null}
      </View>

      {output.kind === 'declined' ? (
        <Banner testID="result-declined-0" tone="warning" title="No lines for this one">
          {output.reason}
        </Banner>
      ) : null}

      {output.kind === 'lines'
        ? output.lines.map((item, position) =>
            line(String(position), set.lineIds[position], item.text, item.hook || undefined),
          )
        : null}

      {output.kind === 'analysis' ? (
        <>
          <Card testID="result-analysis-0" variant="raised">
            <AppText testID="result-interest-0" variant="bodyStrong" color={INTEREST[output.interest].color}>
              {INTEREST[output.interest].label}
            </AppText>
            {output.signals.map((signal) => (
              <AppText key={signal} variant="caption" color="textMuted">
                • {signal}
              </AppText>
            ))}
            <AppText>{output.advice}</AppText>
          </Card>
          {output.suggestedReply ? line('reply', set.lineIds[0], output.suggestedReply, 'Suggested reply') : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  set: { gap: spacing.md },
  header: { gap: spacing.xs },
});
