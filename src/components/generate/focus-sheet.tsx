import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Sheet, TextField } from '@/components/ui';
import { FOCUS_MAX, FOCUSES_MAX, cleanFocus } from '@/engine';
import { useFocusPills } from '@/generate/use-focus-pills';
import { radius, spacing, useTheme } from '@/theme';

export type FocusSheetProps = {
  visible: boolean;
  /** The focuses chosen now (none, or up to three). */
  focus: string[];
  /**
   * True when she counts as a stranger (Stranger, Mutual follow or not set): the lines then
   * stay off her looks whatever the focus, and the sheet says so up front.
   */
  stranger: boolean;
  onSave: (focus: string[]) => void;
  onClose: () => void;
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const pillID = (pill: string) => pill.toLowerCase().replace(/\s+/g, '-');

/**
 * What the lines should be about: up to three pills, picked in a tap. The user's own pills
 * are added from the field and kept for next time; holding a pill removes it (after asking).
 * With a focus the set has five lines, three about it and two of Banter's own picks;
 * without one, Banter chooses.
 */
export function FocusSheet({ visible, focus, stranger, onSave, onClose }: FocusSheetProps) {
  const { colors } = useTheme();
  const { pills, add, remove } = useFocusPills();
  const [chosen, setChosen] = useState<string[]>(focus);
  const [draft, setDraft] = useState('');
  /** The pill being held, to remove once the user says yes. */
  const [removing, setRemoving] = useState<string | null>(null);

  const typed = cleanFocus(draft);
  const isChosen = (pill: string) => chosen.some((item) => same(item, pill));
  const isPill = (text: string) => pills.some((pill) => same(pill, text));
  // A chosen focus that is not a pill (any more) still shows, so it can be taken off.
  const shown = [...chosen.filter((item) => !isPill(item)), ...pills];
  const full = chosen.length >= FOCUSES_MAX;

  const toggle = (pill: string) =>
    setChosen((current) =>
      current.some((item) => same(item, pill))
        ? current.filter((item) => !same(item, pill))
        : current.length >= FOCUSES_MAX
          ? current
          : [...current, pill],
    );

  /** Keeps what was typed as a pill for next time, and picks it now. */
  const addTyped = () => {
    if (!typed) return;
    add(typed);
    setChosen((current) =>
      current.some((item) => same(item, typed)) || current.length >= FOCUSES_MAX ? current : [...current, typed],
    );
    setDraft('');
  };

  const confirmRemove = () => {
    if (!removing) return;
    remove(removing);
    setChosen((current) => current.filter((item) => !same(item, removing)));
    setRemoving(null);
  };

  return (
    <Sheet
      testID="focus-sheet"
      visible={visible}
      title="Focus on"
      subtitle="Optional. Pick up to 3: you get 5 lines, 3 about them and 2 of Banter's own picks."
      onClose={onClose}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <TextField
          testID="focus-input"
          label="Add your own"
          placeholder="the gym, her dog, her bag…"
          value={draft}
          onChangeText={setDraft}
          maxLength={FOCUS_MAX}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={addTyped}
          helper={
            stranger
              ? 'With a stranger, lines stay off her looks: nothing about her hair, face, makeup or body. Clothes are fine as her choice.'
              : undefined
          }
        />

        <View style={styles.pills}>
          {typed && !isPill(typed) ? (
            <Chip testID="focus-add" icon="add" label={`Add "${typed}"`} onPress={addTyped} />
          ) : null}
          {shown.map((pill) => (
            <Chip
              key={pill}
              testID={`focus-pill-${pillID(pill)}`}
              label={capitalised(pill)}
              selected={isChosen(pill)}
              onPress={() => toggle(pill)}
              onLongPress={isPill(pill) ? () => setRemoving(pill) : undefined}
              longPressHint="Hold to remove this pill"
            />
          ))}
        </View>

        {removing ? (
          <View
            testID="focus-remove-confirm"
            style={[styles.confirm, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
            <AppText style={styles.confirmText}>{`Remove "${removing}" from your pills?`}</AppText>
            <Button testID="focus-remove-keep" size="sm" variant="secondary" label="Keep" onPress={() => setRemoving(null)} />
            <Button testID="focus-remove-yes" size="sm" variant="danger" label="Remove" onPress={confirmRemove} />
          </View>
        ) : (
          <AppText testID="focus-hint" variant="caption" color="textMuted">
            {full ? 'That is 3, the most. Tap one to take it off.' : 'Hold a pill to remove it.'}
          </AppText>
        )}
      </ScrollView>

      <View style={styles.buttons}>
        {focus.length > 0 ? (
          <Button testID="focus-clear" style={styles.button} variant="secondary" label="Clear" onPress={() => onSave([])} />
        ) : null}
        <Button
          testID="focus-save"
          style={styles.button}
          icon="check"
          label={chosen.length === 0 ? 'Let Banter choose' : chosen.length === 1 ? 'Use it' : `Use these ${chosen.length}`}
          onPress={() => onSave(chosen)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Fits on a phone; scrolls only on a very small screen, with many pills or very large text.
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: spacing.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  confirmText: { flex: 1 },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1 },
});
