import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth';
import {
  AppText,
  Banner,
  Button,
  ListRow,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Sheet,
  TextField,
  useToast,
} from '@/components/ui';
import { dataErrorMessage } from '@/data';
import { appInfo, type AppInfo } from '@/feedback/app-info';
import { createFeedbackRepo, type FeedbackRepo } from '@/feedback/feedback-repo';
import { FEEDBACK_KINDS, includedItems, setForTicket, ticketContext } from '@/feedback/ticket';
import { useGenerateSession } from '@/generate/generate-provider';
import type { FeedbackKind } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { spacing } from '@/theme';

type FeedbackScreenProps = {
  /** The set of lines the ticket is about, when it is sent from Results. */
  setId?: string;
  /** Tests pass fakes. */
  send?: FeedbackRepo['send'];
  app?: AppInfo;
};

const defaultSend: FeedbackRepo['send'] = (ticket, screenshot) => {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not connected');
  return createFeedbackRepo(client).send(ticket, screenshot);
};

/**
 * Report a problem or send an idea. From Results the set of lines is attached, with the
 * options, the model, the marks on each line and the request as sent; the screenshot too,
 * if the user leaves it on. The user picks the kind and writes what is wrong.
 */
export function FeedbackScreen({ setId, send = defaultSend, app = appInfo() }: FeedbackScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const { session: auth } = useAuth();
  const session = useGenerateSession();

  const set = setId ? (session.sets.find((item) => item.id === setId) ?? null) : null;
  const screenshot = set ? session.screenshot : null;

  const [kind, setKind] = useState<FeedbackKind>(set ? 'lines' : 'bug');
  const [message, setMessage] = useState('');
  const [attach, setAttach] = useState(screenshot !== null);
  const [showIncluded, setShowIncluded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindInfo = FEEDBACK_KINDS.find((item) => item.value === kind) ?? FEEDBACK_KINDS[0];
  // A reported set speaks for itself; anything else needs a few words.
  const noteOptional = set !== null && kind === 'lines';
  const withScreenshot = attach && screenshot !== null;
  const included = includedItems(app, set, withScreenshot);

  const submit = async () => {
    const note = message.trim();
    if (!noteOptional && note.length < 3) return setError('Write a few words about it.');
    setError(null);
    setBusy(true);
    try {
      const marks = {
        liked: session.liked,
        feedback: session.feedback,
        copiedLineId: session.copiedLineId,
        kept: session.kept,
      };
      const context = ticketContext(
        set ? 'results' : 'settings',
        app,
        set ? setForTicket(set, marks, { context: session.context, username: session.username }) : null,
      );
      const userId = auth?.user.id;
      await send(
        { id: uuid(), kind, message: note, context },
        withScreenshot && userId ? { userId, base64: screenshot.image.base64 } : null,
      );
      setBusy(false);
      toast.show('Sent. Thank you!');
      router.back();
    } catch (caught) {
      setBusy(false);
      setError(dataErrorMessage(caught, 'send it'));
    }
  };

  return (
    <Screen
      testID="feedback-screen"
      fill
      footer={<Button testID="feedback-send" icon="report" label="Send" onPress={submit} loading={busy} />}>
      <ScreenHeader
        title={set ? 'Report these lines' : 'Send feedback'}
        subtitle="Banter attaches the details needed to fix it."
        onBack={() => router.back()}
      />

      <SegmentedControl
        testIDPrefix="feedback-kind"
        options={FEEDBACK_KINDS.map(({ value, label }) => ({ value, label }))}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setError(null);
        }}
        disabled={busy}
      />

      <TextField
        testID="feedback-message"
        label={kind === 'idea' ? 'Your idea' : "What's wrong?"}
        placeholder={kindInfo.placeholder}
        helper={noteOptional ? 'Optional: the lines and their details are attached.' : undefined}
        value={message}
        onChangeText={(value) => {
          setMessage(value);
          setError(null);
        }}
        editable={!busy}
        multiline
        maxLength={4000}
      />

      {error ? (
        <Banner tone="danger" messageTestID="feedback-error">
          {error}
        </Banner>
      ) : null}

      <View style={styles.rows}>
        <ListRow
          testID="feedback-included"
          icon="info"
          title="What's attached"
          subtitle={set ? 'This set, its details, the app and your email' : 'The app, your phone and your email'}
          onPress={() => setShowIncluded(true)}
          disabled={busy}
        />
        {screenshot ? (
          <ListRow
            testID="feedback-screenshot"
            icon="screenshot"
            title="Attach the screenshot"
            subtitle="Helps fix it. Only you and Banter's developer can see it."
            value={attach ? 'On' : 'Off'}
            onPress={() => setAttach((on) => !on)}
            disabled={busy}
          />
        ) : null}
      </View>

      <Sheet
        testID="feedback-included-sheet"
        visible={showIncluded}
        title="What's attached"
        subtitle="Sent with your note, so the problem can be found and fixed."
        onClose={() => setShowIncluded(false)}>
        <View style={styles.rows}>
          {included.map((item) => (
            <AppText key={item} color="textMuted">
              {`• ${item}`}
            </AppText>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.sm },
});
