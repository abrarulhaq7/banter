import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Sheet } from '@/components/ui';
import type { ContextId, ToneId } from '@/engine';
import {
  goalsFor,
  pickFor,
  SCREEN_KINDS,
  type Answers,
  type Goal,
  type QuickPick,
  type ScreenKind,
} from '@/generate/quick-questions';
import { CONTEXT_LABELS } from '@/history/labels';
import { spacing } from '@/theme';

const CONTEXTS = Object.keys(CONTEXT_LABELS) as ContextId[];

export type QuickQuestionsSheetProps = {
  visible: boolean;
  /** The answers to start from: what is chosen on Generate now. */
  kind: ScreenKind;
  context: ContextId | null;
  /** A built-in tone's name, as the user sees it. */
  toneLabel: (tone: ToneId) => string;
  /** Whether the questions open by themselves when a screenshot is chosen. */
  askOnPick: boolean;
  onToggleAsk: () => void;
  onApply: (answers: Answers, pick: QuickPick) => void;
  onClose: () => void;
};

/**
 * Three quick questions (what the screenshot is, how he knows her, what he wants) that pick
 * the setup most likely to get the best reply. One tap each; the button names the tone it
 * will use, and everything can still be changed on Generate.
 */
export function QuickQuestionsSheet({
  visible,
  kind: startKind,
  context: startContext,
  toneLabel,
  askOnPick,
  onToggleAsk,
  onApply,
  onClose,
}: QuickQuestionsSheetProps) {
  const [kind, setKind] = useState(startKind);
  const [context, setContext] = useState(startContext);
  const [chosenGoal, setGoal] = useState<Goal | null>(null);

  const goals = goalsFor(kind, context);
  // A goal that no longer fits (heat, once she is a stranger again) counts as not chosen.
  const goal = goals.some((item) => item.value === chosenGoal) ? chosenGoal : null;
  const pick = goal ? pickFor({ kind, context, goal }) : null;

  return (
    <Sheet
      testID="quick-questions-sheet"
      visible={visible}
      title="Quick questions"
      subtitle="Banter picks the tone that gets the best reply. You can change it after."
      onClose={onClose}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Question title="What is it?">
          {SCREEN_KINDS.map((item) => (
            <Chip
              key={item.value}
              testID={`quick-kind-${item.value}`}
              label={item.label}
              selected={kind === item.value}
              onPress={() => setKind(item.value)}
            />
          ))}
        </Question>
        <Question title="How do you know her?">
          {CONTEXTS.map((id) => (
            <Chip
              key={id}
              testID={`quick-context-${id}`}
              label={CONTEXT_LABELS[id]}
              selected={context === id}
              // Tapping the chosen one again clears it, as on Generate.
              onPress={() => setContext((current) => (current === id ? null : id))}
            />
          ))}
        </Question>
        <Question title="What do you want?">
          {goals.map((item) => (
            <Chip
              key={item.value}
              testID={`quick-goal-${item.value}`}
              label={item.label}
              selected={goal === item.value}
              onPress={() => setGoal(item.value)}
            />
          ))}
        </Question>
      </ScrollView>

      <Button
        testID="quick-apply"
        icon="check"
        label={pick ? `Use ${toneLabel(pick.tone)}` : 'Pick what you want'}
        disabled={!pick}
        onPress={() => {
          if (goal && pick) onApply({ kind, context, goal }, pick);
        }}
      />
      <Button
        testID="quick-ask-toggle"
        variant="ghost"
        size="sm"
        label={askOnPick ? "Don't ask when I choose a screenshot" : 'Ask when I choose a screenshot'}
        onPress={onToggleAsk}
      />
    </Sheet>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.question}>
      <AppText variant="label" color="textMuted" accessibilityRole="header">
        {title}
      </AppText>
      <View style={styles.choices}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fits on a phone; scrolls only on a very small screen or with very large text.
  scroll: { flexGrow: 0 },
  body: { gap: spacing.lg },
  question: { gap: spacing.sm },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
