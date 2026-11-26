import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemePicker } from '@/components/theme-picker';
import { AppText, Button, Card, Chip, Screen, TextField } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/**
 * Design preview: shows the theme and every building block so they can be checked on a
 * device. Only reachable in development builds (see the guard in _layout.tsx).
 */

const MODES = ['Story reply', 'Opener', 'Reply', 'Analyse'] as const;
const TONES = ['Casual', 'Funny', 'Flirty', 'Confident', 'Safe'] as const;

export default function FoundationScreen() {
  const { label: themeLabel } = useTheme();
  const [mode, setMode] = useState<(typeof MODES)[number]>('Story reply');
  const [tone, setTone] = useState<(typeof TONES)[number]>('Casual');
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');

  return (
    <Screen testID="foundation-screen">
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Banter
        </AppText>
        <AppText color="textMuted">Design preview. Themes and building blocks.</AppText>
      </View>

      <Section title="Theme" detail={themeLabel}>
        <ThemePicker />
      </Section>

      <Section title="Mode">
        <View style={styles.chips}>
          {MODES.map((item) => (
            <Chip
              key={item}
              testID={`mode-${item}`}
              label={item}
              selected={item === mode}
              onPress={() => setMode(item)}
            />
          ))}
        </View>
      </Section>

      <Section title="Tone">
        <View style={styles.chips}>
          {TONES.map((item) => (
            <Chip
              key={item}
              testID={`tone-${item}`}
              label={item}
              selected={item === tone}
              onPress={() => setTone(item)}
            />
          ))}
        </View>
      </Section>

      <Section title="Line card">
        <Card
          testID="sample-line"
          selected={copied}
          onPress={() => setCopied((value) => !value)}
          accessibilityLabel={copied ? 'Sample line. Copied.' : 'Sample line. Tap to copy.'}>
          <AppText variant="caption" color="accentAlt">
            Noticed: the ramen bowl in the corner
          </AppText>
          <AppText>Okay, but where is that ramen from? Asking for my weekend.</AppText>
          <AppText variant="caption" color={copied ? 'success' : 'textMuted'}>
            {copied ? 'Copied' : 'Tap to copy'}
          </AppText>
        </Card>
      </Section>

      <Section title="Text input">
        <TextField
          testID="sample-input"
          label="How you text"
          placeholder="Short, lowercase, a bit dry"
          helper="Free text. Used to make lines sound like you."
          value={note}
          onChangeText={setNote}
        />
        <TextField
          label="API key"
          placeholder="Paste your key"
          value="not-a-real-key"
          editable={false}
          error="This key was rejected. Check it and try again."
        />
      </Section>

      <Section title="Buttons">
        <Button testID="button-primary" label="New lines" />
        <View style={styles.buttonRow}>
          <Button style={styles.fill} variant="secondary" label="Shorter" />
          <Button style={styles.fill} variant="secondary" label="Bolder" />
        </View>
        <Button variant="primary" label="Loading" loading />
        <Button variant="primary" label="Disabled" disabled />
        <Button variant="ghost" label="Reset to default" />
      </Section>
    </Screen>
  );
}

type SectionProps = {
  title: string;
  detail?: string;
  children: ReactNode;
};

function Section({ title, detail, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {detail ? (
          <AppText variant="label" color="textMuted" testID={`section-detail-${title}`}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  buttonRow: { flexDirection: 'row', gap: spacing.md },
  fill: { flex: 1 },
});
