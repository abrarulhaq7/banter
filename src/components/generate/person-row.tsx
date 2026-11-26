import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, TextField } from '@/components/ui';
import { spacing } from '@/theme';

type PersonRowProps = {
  /** Null when the AI could not read a username. */
  username: string | null;
  /** Returns a message when the username is not valid, or null when it was accepted. */
  onChange: (username: string) => string | null;
};

/** Who the lines are saved under. The AI reads the username; the user can correct it. */
export function PersonRow({ username, onChange }: PersonRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setDraft(username ?? '');
    setError(null);
    setEditing(true);
  };
  const save = () => {
    const problem = onChange(draft);
    if (problem) setError(problem);
    else setEditing(false);
  };

  if (editing) {
    return (
      <Card testID="person-edit">
        <TextField
          testID="person-input"
          label="Her Instagram username"
          placeholder="username"
          value={draft}
          onChangeText={setDraft}
          error={error ?? undefined}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          maxLength={31}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <View style={styles.actions}>
          <Button testID="person-save" style={styles.fill} size="sm" label="Save" onPress={save} />
          <Button
            testID="person-cancel"
            style={styles.fill}
            size="sm"
            variant="secondary"
            label="Cancel"
            onPress={() => setEditing(false)}
          />
        </View>
      </Card>
    );
  }

  return (
    <View testID="person-row" style={styles.row}>
      <View style={styles.fill}>
        <AppText variant="caption" color="textMuted">
          Saved under
        </AppText>
        <AppText testID="person-username" variant="bodyStrong" numberOfLines={1}>
          {username ? `@${username}` : 'No username read'}
        </AppText>
      </View>
      <Button
        testID="person-change"
        variant="ghost"
        size="sm"
        label={username ? 'Change' : 'Add username'}
        onPress={start}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
});
