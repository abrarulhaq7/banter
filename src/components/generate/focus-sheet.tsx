import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Sheet, TextField } from '@/components/ui';
import { FOCUS_MAX } from '@/engine';
import { spacing } from '@/theme';

/** Things people often want lines about. A tap fills them in. */
const SUGGESTIONS = ['her hair', 'her nails', 'her dress', 'her outfit', 'the food', 'the place', 'the music', 'her pet'];

export type FocusSheetProps = {
  visible: boolean;
  /** The focus chosen now, or null. */
  focus: string | null;
  /**
   * True when she counts as a stranger (Stranger, Mutual follow or not set): the lines then
   * stay off her looks whatever the focus, and the sheet says so up front.
   */
  stranger: boolean;
  onSave: (focus: string | null) => void;
  onClose: () => void;
};

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * What the lines should be about: typed, or one of a few suggestions. With a focus the set has
 * five lines, three about it and two of Banter's own picks; without one, Banter chooses.
 */
export function FocusSheet({ visible, focus, stranger, onSave, onClose }: FocusSheetProps) {
  const [draft, setDraft] = useState(focus ?? '');
  const typed = draft.trim();

  return (
    <Sheet
      testID="focus-sheet"
      visible={visible}
      title="Focus on"
      subtitle="Optional. You get 5 lines: 3 about it, and 2 of Banter's own picks."
      onClose={onClose}>
      <TextField
        testID="focus-input"
        label="What the lines are about"
        placeholder="her nails, the café, her dog…"
        value={draft}
        onChangeText={setDraft}
        maxLength={FOCUS_MAX}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => onSave(typed || null)}
        helper={
          stranger
            ? 'With a stranger, lines stay off her looks: nothing about her hair, face, makeup or body. Clothes are fine as her choice.'
            : undefined
        }
      />
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((suggestion) => (
          <Chip
            key={suggestion}
            testID={`focus-suggestion-${suggestion.replace(/\s+/g, '-')}`}
            label={capitalised(suggestion)}
            selected={typed.toLowerCase() === suggestion}
            onPress={() => setDraft(suggestion)}
          />
        ))}
      </View>
      <View style={styles.buttons}>
        {focus ? (
          <Button
            testID="focus-clear"
            style={styles.button}
            variant="secondary"
            label="Clear"
            onPress={() => onSave(null)}
          />
        ) : null}
        <Button
          testID="focus-save"
          style={styles.button}
          icon="check"
          label={typed ? 'Use it' : 'Let Banter choose'}
          onPress={() => onSave(typed || null)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1 },
});
