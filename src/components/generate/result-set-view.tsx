import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import type { Interest } from '@/engine';
import { setLabel, type KeptLine, type ResultSet } from '@/generate/session';
import { spacing, type ColorRole } from '@/theme';

import { LineCard } from './line-card';

type ResultSetViewProps = {
  set: ResultSet;
  /** 0 is the newest set. Used in test ids. */
  index: number;
  copiedLineId: string | null;
  keptIds: ReadonlySet<string>;
  onCopy: (lineId: string, text: string) => void;
  onToggleKeep: (line: KeptLine) => void;
};

const ADJUSTMENT_LABEL = { new_lines: 'New lines', shorter: 'Shorter', bolder: 'Bolder' } as const;

const INTEREST: Record<Interest, { label: string; color: ColorRole }> = {
  high: { label: 'She seems interested', color: 'success' },
  medium: { label: 'Some interest', color: 'accentAlt' },
  low: { label: 'Not much interest', color: 'danger' },
  unclear: { label: 'Hard to tell', color: 'textMuted' },
};

/** One generation: its label, what was noticed, and the lines or the analysis. */
export function ResultSetView({ set, index, copiedLineId, keptIds, onCopy, onToggleKeep }: ResultSetViewProps) {
  const { output } = set;
  const label = setLabel(set);
  const heading = [label, set.adjustment ? ADJUSTMENT_LABEL[set.adjustment] : null].filter(Boolean).join(' · ');

  /** `position` names the line in test ids; `id` is the saved line's id. */
  const line = (position: string, id: string, text: string, caption?: string) => {
    return (
      <LineCard
        key={id}
        testKey={`${index}-${position}`}
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
    <View testID={`result-set-${index}`} style={styles.set}>
      <View style={styles.header}>
        <AppText testID={`result-heading-${index}`} variant="heading" accessibilityRole="header">
          {heading}
        </AppText>
        {output.username ? (
          <AppText testID={`result-username-${index}`} variant="label" color="textMuted">
            @{output.username}
          </AppText>
        ) : null}
      </View>

      {output.noticed ? (
        <AppText testID={`result-noticed-${index}`} variant="caption" color="textMuted">
          Noticed: {output.noticed}
        </AppText>
      ) : null}

      {output.kind === 'declined' ? (
        <Card testID={`result-declined-${index}`}>
          <AppText variant="label" color="accentAlt">
            No lines for this one
          </AppText>
          <AppText>{output.reason}</AppText>
        </Card>
      ) : null}

      {output.kind === 'lines'
        ? output.lines.map((item, position) =>
            line(String(position), set.lineIds[position], item.text, item.hook || undefined),
          )
        : null}

      {output.kind === 'analysis' ? (
        <>
          <Card testID={`result-analysis-${index}`}>
            <AppText testID={`result-interest-${index}`} variant="bodyStrong" color={INTEREST[output.interest].color}>
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
  set: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
});
