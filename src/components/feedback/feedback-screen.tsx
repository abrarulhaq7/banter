import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth';
import {
  AppText,
  Banner,
  Button,
  IconButton,
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
import { createFeedbackRepo, MAX_PICTURES, type FeedbackRepo } from '@/feedback/feedback-repo';
import { FEEDBACK_KINDS, includedItems, setForTicket, ticketContext } from '@/feedback/ticket';
import { useGenerateSession } from '@/generate/generate-provider';
import type { FeedbackKind } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { pickPictures, type PreparedScreenshot } from '@/screenshot';
import { radius, spacing, useTheme } from '@/theme';

type FeedbackScreenProps = {
  /** The set of lines the ticket is about, when it is sent from Results. */
  setId?: string;
  /** Tests pass fakes. */
  send?: FeedbackRepo['send'];
  app?: AppInfo;
  pick?: (limit: number) => Promise<PreparedScreenshot[]>;
};

const defaultSend: FeedbackRepo['send'] = (ticket, files) => {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not connected');
  return createFeedbackRepo(client).send(ticket, files);
};

/**
 * Report a problem or send an idea. From Results the set of lines is attached, with the
 * options, the model, the marks on each line and the request as sent; the screenshot too,
 * if the user leaves it on. The user picks the kind, writes what is wrong, and can add up to
 * three pictures of their own (a screenshot of the problem).
 */
export function FeedbackScreen({
  setId,
  send = defaultSend,
  app = appInfo(),
  pick = pickPictures,
}: FeedbackScreenProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { session: auth } = useAuth();
  const session = useGenerateSession();

  const set = setId ? (session.sets.find((item) => item.id === setId) ?? null) : null;
  const screenshot = set ? session.screenshot : null;

  const [kind, setKind] = useState<FeedbackKind>(set ? 'lines' : 'bug');
  const [message, setMessage] = useState('');
  const [attach, setAttach] = useState(screenshot !== null);
  const [pictures, setPictures] = useState<PreparedScreenshot[]>([]);
  const [showIncluded, setShowIncluded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindInfo = FEEDBACK_KINDS.find((item) => item.value === kind) ?? FEEDBACK_KINDS[0];
  // A reported set speaks for itself; anything else needs a few words.
  const noteOptional = set !== null && kind === 'lines';
  const withScreenshot = attach && screenshot !== null;
  const included = includedItems(app, set, withScreenshot, pictures.length);
  const roomLeft = MAX_PICTURES - pictures.length;

  const addPictures = async () => {
    setError(null);
    try {
      const picked = await pick(roomLeft);
      if (picked.length > 0) setPictures((current) => [...current, ...picked].slice(0, MAX_PICTURES));
    } catch {
      setError('Could not open that picture. Try another one.');
    }
  };

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
        userId
          ? {
              userId,
              screenshot: withScreenshot ? screenshot.image.base64 : null,
              pictures: pictures.map((picture) => picture.image.base64),
            }
          : null,
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
        <ListRow
          testID="feedback-add-pictures"
          icon="gallery"
          title="Add pictures"
          subtitle="A screenshot of the problem helps."
          value={pictures.length > 0 ? `${pictures.length} of ${MAX_PICTURES}` : `Up to ${MAX_PICTURES}`}
          onPress={addPictures}
          disabled={busy || roomLeft === 0}
        />
      </View>

      {pictures.length > 0 ? (
        <View testID="feedback-pictures" style={styles.pictures}>
          {pictures.map((picture, index) => (
            <View
              key={picture.previewUri}
              style={[styles.picture, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Image
                testID={`feedback-picture-${index}`}
                source={{ uri: picture.previewUri }}
                resizeMode="cover"
                accessibilityLabel={`Picture ${index + 1}`}
                style={styles.pictureImage}
              />
              <IconButton
                testID={`feedback-picture-remove-${index}`}
                icon="close"
                label={`Remove picture ${index + 1}`}
                variant="filled"
                onPress={() => setPictures((current) => current.filter((_, at) => at !== index))}
                disabled={busy}
                style={styles.pictureRemove}
              />
            </View>
          ))}
        </View>
      ) : null}

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

const PICTURE_SIZE = 96;

const styles = StyleSheet.create({
  rows: { gap: spacing.sm },
  pictures: { flexDirection: 'row', gap: spacing.sm },
  picture: {
    width: PICTURE_SIZE,
    height: PICTURE_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pictureImage: { flex: 1 },
  pictureRemove: { position: 'absolute', top: spacing.xxs, right: spacing.xxs },
});
