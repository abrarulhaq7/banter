import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  Card,
  ChipRow,
  Chip,
  IconButton,
  OptionList,
  Screen,
  ScreenHeader,
  Sheet,
  TextField,
} from '@/components/ui';
import { learnedToneText } from '@/engine';
import { haptics } from '@/lib/haptics';
import { TONE_DEFINITION_MAX, usePrompts } from '@/prompts';
import { useLearnTone, type LearnDeps } from '@/prompts/use-learn-tone';
import { radius, spacing, useTheme } from '@/theme';

type LearnToneScreenProps = {
  /** Tests replace the AI call and the photo library. */
  deps?: Partial<LearnDeps>;
};

/**
 * My tones > Learn from an example. The user shows Banter a line they liked; Banter says
 * what makes it work and offers it as a tone. Saving goes through the tone editor, so the
 * user sees exactly what is saved and can change it first.
 */
export function LearnToneScreen({ deps }: LearnToneScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { tones } = usePrompts();
  const learn = useLearnTone(deps);
  const [chosen, setChosen] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const found = learn.result?.kind === 'learned' ? learn.result.styles : [];
  const style = found[Math.min(chosen, found.length - 1)];

  const ask = async () => {
    setChosen(0);
    await learn.ask();
  };

  const saveAsNew = () => {
    if (!style) return;
    // Replaced, not stacked: after saving, Back goes to My tones, not to this screen.
    router.replace({
      pathname: '/tones/new',
      params: { label: style.name, definition: learnedToneText(style, TONE_DEFINITION_MAX) },
    });
  };

  const addTo = (key: string) => {
    if (!style) return;
    setAddOpen(false);
    router.replace({ pathname: '/tones/[key]', params: { key, append: style.definition } });
  };

  // --- The result -------------------------------------------------------------------------
  if (learn.phase === 'done' && learn.result) {
    return (
      <Screen
        testID="learn-tone-screen"
        footer={
          learn.result.kind === 'learned' ? (
            <View style={styles.footerRow}>
              <Button
                testID="learn-add-to"
                style={styles.fill}
                variant="secondary"
                label="Add to a tone"
                onPress={() => setAddOpen(true)}
              />
              <Button testID="learn-save-new" style={styles.fill} icon="add" label="New tone" onPress={saveAsNew} />
            </View>
          ) : (
            <Button testID="learn-again" label="Try another example" onPress={learn.startOver} />
          )
        }>
        <ScreenHeader title="What makes it work" onBack={learn.startOver} />

        {learn.result.kind === 'declined' ? (
          <Banner testID="learn-declined" tone="warning" title="Nothing to learn from this one">
            {learn.result.reason}
          </Banner>
        ) : null}

        {found.length > 1 ? (
          <ChipRow testID="learn-lines">
            {found.map((item, index) => (
              <Chip
                key={item.line}
                testID={`learn-line-${index}`}
                label={`Line ${index + 1}`}
                selected={index === chosen}
                onPress={() => setChosen(index)}
              />
            ))}
          </ChipRow>
        ) : null}

        {style ? (
          <>
            <Card variant="tinted" testID="learn-example">
              <AppText variant="label" color="textMuted">
                The line
              </AppText>
              <AppText testID="learn-example-line" variant="bodyStrong">
                “{style.line}”
              </AppText>
            </Card>

            <View style={styles.block}>
              <AppText testID="learn-name" variant="heading">
                {style.name}
              </AppText>
              <AppText testID="learn-why">{style.whyItWorks}</AppText>
            </View>

            <View style={styles.block}>
              <AppText variant="label" color="textMuted">
                As a tone
              </AppText>
              <AppText testID="learn-definition" color="textMuted">
                {style.definition}
              </AppText>
            </View>

            {style.samples.length > 0 ? (
              <View style={styles.block}>
                <AppText variant="label" color="textMuted">
                  In this style, about other things
                </AppText>
                {style.samples.map((sample, index) => (
                  <Card key={sample} testID={`learn-sample-${index}`}>
                    <AppText>{sample}</AppText>
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        <Sheet
          testID="learn-add-sheet"
          visible={addOpen}
          title="Add to which tone?"
          subtitle="The style is added to its description. You can change it before saving."
          onClose={() => setAddOpen(false)}>
          <OptionList
            testIDPrefix="learn-add"
            options={tones.map((tone) => ({ value: tone.key, label: tone.label }))}
            value={null}
            onSelect={addTo}
          />
        </Sheet>
      </Screen>
    );
  }

  // --- Choosing the example ---------------------------------------------------------------
  const busy = learn.phase !== 'idle';
  return (
    <Screen
      testID="learn-tone-screen"
      fill
      footer={
        <Button
          testID="learn-run"
          icon="generate"
          label="Learn this style"
          onPress={() => {
            void ask().then(() => haptics.success());
          }}
          disabled={!learn.canAsk}
          loading={learn.phase === 'asking'}
        />
      }>
      <ScreenHeader
        title="Learn from an example"
        subtitle="Show Banter a line you liked. It works out the move, so it can write like that."
        onBack={() => router.back()}
      />

      {!learn.hasUsableKey ? (
        <Banner testID="learn-no-key" tone="warning" title="No AI key to use">
          This needs one working key, like writing lines does.
        </Banner>
      ) : null}

      <View style={[styles.zone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {learn.screenshot ? (
          <>
            <Image
              testID="learn-preview"
              source={{ uri: learn.screenshot.previewUri }}
              resizeMode="contain"
              accessibilityLabel="The screenshot with the line"
              style={styles.fill}
            />
            <IconButton
              testID="learn-clear"
              icon="close"
              label="Remove the screenshot"
              variant="filled"
              onPress={learn.clearScreenshot}
              disabled={busy}
              style={styles.clear}
            />
          </>
        ) : learn.phase === 'loading' ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <View style={styles.empty}>
            <AppText color="textMuted" style={styles.center}>
              A screenshot of the comment or message you liked.
            </AppText>
          </View>
        )}
      </View>
      <View style={styles.footerRow}>
        <Button
          testID="learn-latest"
          style={styles.fill}
          size="sm"
          variant="secondary"
          icon="screenshot"
          label="Use latest"
          onPress={learn.useLatest}
          disabled={busy}
        />
        <Button
          testID="learn-gallery"
          style={styles.fill}
          size="sm"
          variant="secondary"
          icon="gallery"
          label="From gallery"
          onPress={learn.pick}
          disabled={busy}
        />
      </View>

      <TextField
        testID="learn-text"
        label="Or paste the line"
        placeholder="you look like you'd steal my hoodie…"
        value={learn.text}
        onChangeText={learn.setText}
        editable={!busy}
        multiline
        maxLength={300}
      />

      {learn.phase === 'asking' ? (
        <View testID="learn-asking" style={styles.asking}>
          <ActivityIndicator color={colors.accent} />
          <AppText color="textMuted">Working out what makes it work…</AppText>
        </View>
      ) : null}
      {learn.error ? (
        <Banner tone="danger" messageTestID="learn-error">
          {learn.error}
        </Banner>
      ) : null}

      <AppText variant="caption" color="textMuted">
        Sent to your AI provider with your own key, like a screenshot for lines. Nothing is saved
        until you save the tone.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  zone: { flex: 1, minHeight: 140, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  center: { textAlign: 'center' },
  clear: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  fill: { flex: 1 },
  block: { gap: spacing.sm },
  asking: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
