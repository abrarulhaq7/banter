import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemePicker } from '@/components/theme-picker';
import {
  AppText,
  Avatar,
  Banner,
  BarButton,
  Button,
  Card,
  Chip,
  Dialog,
  ICON_NAMES,
  Icon,
  IconButton,
  ListRow,
  OptionList,
  Screen,
  SegmentedControl,
  Sheet,
  TextField,
  useToast,
} from '@/components/ui';
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
  const toast = useToast();
  const [segment, setSegment] = useState<'story' | 'opener' | 'reply'>('story');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [option, setOption] = useState<'a' | 'b' | null>('a');

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

      <Section title="Icons">
        <View style={styles.icons}>
          {ICON_NAMES.map((name) => (
            <Icon key={name} name={name} size={22} color="accent" />
          ))}
        </View>
        <View style={styles.buttonRow}>
          <IconButton testID="sample-icon-button" icon="copy" label="Copy" variant="filled" />
          <IconButton icon="kept" label="Kept" variant="filled" color="accent" />
          <IconButton icon="edit" label="Edit" />
        </View>
      </Section>

      <Section title="Notices">
        <Banner testID="banner-info" tone="info" title="Good to know">
          2 changes are waiting to be saved.
        </Banner>
        <Banner tone="warning" title="Add an AI key to start" action={{ label: 'Add a key', onPress: () => {} }}>
          Banter writes lines with your own key.
        </Banner>
        <Banner tone="success" title="Key accepted">
          Gemini answered. You are ready.
        </Banner>
        <Banner tone="danger">No connection. Check your internet and try again.</Banner>
      </Section>

      <Section title="Rows and cards">
        <ListRow testID="sample-row" icon="key" title="AI keys" subtitle="2 keys saved, 2 active." onPress={() => {}} />
        <ListRow leading={<Avatar name="some.one" />} title="@some.one" subtitle="Mutual follow · 2 days ago" onPress={() => {}} />
        <ListRow icon="signOut" tone="danger" title="Sign out" trailing={<View />} onPress={() => setDialogOpen(true)} />
        <Card variant="raised">
          <AppText variant="bodyStrong" color="success">
            She seems interested
          </AppText>
          <AppText variant="caption" color="textMuted">
            A raised card, for a result that should stand out.
          </AppText>
        </Card>
        <Card variant="tinted">
          <AppText variant="caption" color="accent">
            A tinted card
          </AppText>
        </Card>
      </Section>

      <Section title="Choosing">
        <SegmentedControl
          testIDPrefix="segment"
          options={[
            { value: 'story', label: 'Story reply' },
            { value: 'opener', label: 'Opener' },
            { value: 'reply', label: 'Reply' },
          ]}
          value={segment}
          onChange={setSegment}
        />
        <View style={styles.buttonRow}>
          <BarButton icon="tone" label="Tone" onPress={() => setSheetOpen(true)} testID="open-sheet" />
          <BarButton icon="newLines" label="New lines" onPress={() => toast.show('New lines')} />
          <BarButton icon="shorter" label="Shorter" />
          <BarButton icon="bolder" label="Bolder" />
        </View>
        <View style={styles.buttonRow}>
          <Button testID="open-dialog" style={styles.fill} variant="secondary" icon="delete" label="Dialog" onPress={() => setDialogOpen(true)} />
          <Button testID="show-toast" style={styles.fill} variant="secondary" icon="copy" label="Toast" onPress={() => toast.show('Copied')} />
        </View>
      </Section>

      <Sheet visible={sheetOpen} title="Another tone" subtitle="A sheet, for a small choice." onClose={() => setSheetOpen(false)}>
        <OptionList
          testIDPrefix="sample-option"
          options={[
            { value: 'a', label: 'Flirty' },
            { value: 'b', label: 'Confident', subtitle: 'Direct, sure of yourself' },
          ]}
          value={option}
          onSelect={(value) => {
            setOption(value);
            setSheetOpen(false);
          }}
        />
      </Sheet>
      <Dialog
        visible={dialogOpen}
        tone="danger"
        icon="delete"
        title="Delete this key?"
        message="Banter will stop using it. You can add it again later."
        confirmLabel="Delete"
        onConfirm={() => setDialogOpen(false)}
        onCancel={() => setDialogOpen(false)}
      />

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
        <Button testID="button-primary" icon="generate" label="Get lines" />
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
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
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
