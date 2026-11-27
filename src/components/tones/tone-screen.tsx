import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  Dialog,
  IconButton,
  ListRow,
  Screen,
  ScreenHeader,
  TextField,
  useToast,
} from '@/components/ui';
import {
  TONE_DEFINITION_MAX,
  TONE_LABEL_MAX,
  toneDefinitionProblem,
  toneLabelProblem,
  usePrompts,
  type Tone,
} from '@/prompts';
import { useToneVisibility } from '@/prompts/use-tone-visibility';
import { useTheme } from '@/theme';

type ToneScreenProps = {
  /** The tone to change. Left out to make a new one. */
  toneKey?: string;
};

/**
 * One tone: its definition, and its name when it is the user's own. Save is pinned to the
 * bottom. One of Banter's tones can be put back as Banter wrote it; an own tone can be deleted.
 */
export function ToneScreen({ toneKey }: ToneScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const prompts = usePrompts();
  const tone = toneKey ? prompts.tones.find((item) => item.key === toneKey) : undefined;

  // The form starts from what is saved, so it waits until that is known.
  if (prompts.status === 'loading') {
    return (
      <Screen testID="tone-screen" scroll={false} contentStyle={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (toneKey && !tone) {
    return (
      <Screen testID="tone-screen" fill>
        <ScreenHeader title="Tone not found" subtitle="It may have been deleted." onBack={() => router.back()} />
      </Screen>
    );
  }
  return <ToneForm tone={tone} />;
}

function ToneForm({ tone }: { tone: Tone | undefined }) {
  const router = useRouter();
  const toast = useToast();
  const prompts = usePrompts();
  const isNew = !tone;
  const isOwn = isNew || tone?.kind === 'custom';
  const visibility = useToneVisibility();
  const shownOnGenerate = tone ? !visibility.hidden.has(tone.key) : true;

  const [label, setLabel] = useState(tone?.label ?? '');
  const [definition, setDefinition] = useState(tone?.definition ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [asking, setAsking] = useState<null | 'reset' | 'delete'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelProblem = isOwn ? toneLabelProblem(label, prompts.tones, tone?.key) : null;
  const definitionProblem = toneDefinitionProblem(definition);
  const changed = isNew || label.trim() !== tone?.label || definition.trim() !== tone?.definition.trim();

  const finish = (message: string) => {
    toast.show(message);
    router.back();
  };

  const save = async () => {
    setError(null);
    setShowErrors(true);
    if (labelProblem || definitionProblem) return;

    setBusy(true);
    const result = isNew
      ? await prompts.addCustomTone(label, definition)
      : tone?.kind === 'custom'
        ? await prompts.updateCustomTone(tone.key, label, definition)
        : await prompts.saveToneDefinition(tone?.toneId ?? '', definition);
    setBusy(false);
    if (result.ok) finish('Saved');
    else setError(result.message);
  };

  const confirm = async () => {
    if (!tone) return;
    setError(null);
    setBusy(true);
    const result =
      asking === 'delete' ? await prompts.removeCustomTone(tone.key) : await prompts.resetTone(tone.toneId ?? '');
    setBusy(false);
    const done = asking === 'delete' ? 'Deleted' : "Back to Banter's version";
    setAsking(null);
    if (result.ok) finish(done);
    else setError(result.message);
  };

  const headerRight =
    tone?.kind === 'custom' ? (
      <IconButton testID="tone-delete" icon="delete" label="Delete this tone" color="danger" onPress={() => setAsking('delete')} disabled={busy} />
    ) : tone?.kind === 'edited' ? (
      <Button testID="tone-reset" variant="ghost" size="sm" label="Reset" onPress={() => setAsking('reset')} disabled={busy} />
    ) : undefined;

  return (
    <Screen
      testID="tone-screen"
      fill
      footer={<Button testID="tone-save" label="Save" onPress={save} loading={busy} disabled={!changed} />}>
      <ScreenHeader
        title={isNew ? 'New tone' : (tone?.label ?? '')}
        titleTestID="tone-title"
        subtitle={
          isNew
            ? 'Name it, then describe how its lines should sound.'
            : tone?.kind === 'edited'
              ? 'Your version. Reset puts back what Banter wrote.'
              : tone?.kind === 'custom'
                ? 'A tone you made.'
                : "Banter's version. Change it to make it yours."
        }
        onBack={() => router.back()}
        right={headerRight}
      />

      {isOwn ? (
        <TextField
          testID="tone-name"
          label="Name"
          placeholder="Dry, Nerdy, Chill"
          value={label}
          onChangeText={setLabel}
          error={showErrors ? (labelProblem ?? undefined) : undefined}
          editable={!busy}
          maxLength={TONE_LABEL_MAX}
          autoCapitalize="sentences"
        />
      ) : null}

      <TextField
        testID="tone-definition"
        label="How lines in this tone should sound"
        placeholder="Short and dry. Lowercase. One small joke about the situation, never about her."
        helper={`${definition.trim().length} of ${TONE_DEFINITION_MAX} characters`}
        value={definition}
        onChangeText={setDefinition}
        error={showErrors ? (definitionProblem ?? undefined) : undefined}
        editable={!busy}
        multiline
      />

      {tone ? (
        <ListRow
          testID="tone-visibility"
          icon={shownOnGenerate ? 'shown' : 'hidden'}
          title="Show on Generate"
          value={shownOnGenerate ? 'On' : 'Off'}
          trailing={<View />}
          onPress={() => visibility.toggle(tone.key)}
        />
      ) : null}

      {error ? (
        <Banner tone="danger" messageTestID="tone-error">
          {error}
        </Banner>
      ) : null}

      <AppText variant="caption" color="textMuted">
        This changes the style of the lines. Banter&apos;s rules stay the same: lines hook to the
        screenshot, stay respectful and never push after silence.
      </AppText>

      <Dialog
        visible={asking === 'reset'}
        title="Go back to Banter's version?"
        message={`Your version of ${tone?.label ?? 'this tone'} will be replaced by: "${tone?.defaultDefinition ?? ''}"`}
        confirmLabel="Reset"
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setAsking(null)}
      />
      <Dialog
        visible={asking === 'delete'}
        tone="danger"
        icon="delete"
        title="Delete this tone?"
        message={`"${tone?.label ?? ''}" will be removed. Lines already written in it are kept.`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setAsking(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
});
