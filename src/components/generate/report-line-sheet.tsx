import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth';
import { AppText, Banner, Button, ListRow, Sheet, TextField } from '@/components/ui';
import { dataErrorMessage } from '@/data';
import { appInfo, type AppInfo } from '@/feedback/app-info';
import type { FeedbackRepo } from '@/feedback/feedback-repo';
import { sendFeedback } from '@/feedback/send';
import { setForTicket, ticketContext } from '@/feedback/ticket';
import { useGenerateSession } from '@/generate/generate-provider';
import type { ResultSet } from '@/generate/session';
import { uuid } from '@/lib/uuid';
import { radius, spacing, useTheme } from '@/theme';

export type ReportLineSheetProps = {
  visible: boolean;
  set: ResultSet;
  /** The line's place in the set, from 0. */
  position: number;
  onClose: () => void;
  /** After the report was sent. */
  onSent: () => void;
  /** Tests pass fakes. */
  send?: FeedbackRepo['send'];
  app?: AppInfo;
};

/**
 * Reports one line of a set: the user says why, in their own words. The ticket carries the
 * line, the whole set with its options and marks, the request as sent, and the screenshot
 * unless it is switched off, like "Report these lines" does for the whole set.
 */
export function ReportLineSheet({
  visible,
  set,
  position,
  onClose,
  onSent,
  send = sendFeedback,
  app = appInfo(),
}: ReportLineSheetProps) {
  const { colors } = useTheme();
  const { session: auth } = useAuth();
  const session = useGenerateSession();
  const screenshot = session.screenshot;
  const [why, setWhy] = useState('');
  const [attach, setAttach] = useState(screenshot !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const line = set.output.kind === 'lines' ? set.output.lines[position] : undefined;
  if (!line) return null;

  const submit = async () => {
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
        'results',
        app,
        setForTicket(set, marks, { context: session.context, username: session.username }),
        { position: position + 1, text: line.text, hook: line.hook, move: line.move ?? null },
      );
      const userId = auth?.user.id;
      await send(
        { id: uuid(), kind: 'lines', message: why.trim(), context },
        userId
          ? { userId, screenshot: attach && screenshot ? screenshot.image.base64 : null, pictures: [] }
          : null,
      );
      setBusy(false);
      onSent();
    } catch (caught) {
      setBusy(false);
      setError(dataErrorMessage(caught, 'send it'));
    }
  };

  return (
    <Sheet
      testID="report-line-sheet"
      visible={visible}
      title="Report this line"
      subtitle="It goes to Banter's developer with this set's details, so it can be fixed."
      onClose={onClose}>
      <View style={[styles.quote, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <AppText testID="report-line-text">{line.text}</AppText>
      </View>
      <TextField
        testID="report-line-why"
        label="Why are you reporting it?"
        placeholder="A wrong detail, too cheesy, makes no sense…"
        value={why}
        onChangeText={(value) => {
          setWhy(value);
          setError(null);
        }}
        editable={!busy}
        multiline
        maxLength={2000}
      />
      {screenshot ? (
        <ListRow
          testID="report-line-screenshot"
          icon="screenshot"
          title="Attach the screenshot"
          subtitle="Only you and Banter's developer can see it."
          value={attach ? 'On' : 'Off'}
          onPress={() => setAttach((on) => !on)}
          disabled={busy}
        />
      ) : null}
      {error ? (
        <Banner tone="danger" messageTestID="report-line-error">
          {error}
        </Banner>
      ) : null}
      <Button testID="report-line-send" icon="report" label="Send report" onPress={submit} loading={busy} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  quote: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
});
