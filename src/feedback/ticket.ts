import type { LineFeedback } from '@/engine';
import type { KeptLine, ResultSet } from '@/generate/session';
import type { ContextId, FeedbackKind } from '@/lib/database.types';

/**
 * What goes into a feedback ticket. The user picks the kind and writes a note; the app
 * attaches everything needed to understand and fix the problem, so nobody has to ask.
 */

export const FEEDBACK_KINDS: { value: FeedbackKind; label: string; placeholder: string }[] = [
  { value: 'lines', label: 'Lines', placeholder: 'What is off? Too cheesy, a wrong detail, misread the chat…' },
  { value: 'wording', label: 'Wording', placeholder: 'Which words in the app are wrong or confusing?' },
  { value: 'bug', label: 'Bug', placeholder: 'What happened, and what did you expect?' },
  { value: 'idea', label: 'Idea', placeholder: 'What would make Banter better?' },
];

/** The app and the phone it runs on. */
export type AppInfo = { version: string; platform: string; os: string; device: string | null };

/** What the user did with the lines of a set. */
export type LineMarks = {
  liked: Readonly<Record<string, true>>;
  feedback: Readonly<Record<string, LineFeedback>>;
  copiedLineId: string | null;
  kept: readonly KeptLine[];
};

/** The parts of the session that say who the set was for. */
export type SetSession = { context: ContextId | null; username: string | null };

/**
 * Everything about one set of lines: the options it was asked with, which model answered,
 * what came back with what the user did with each line, and the request exactly as sent.
 */
export function setForTicket(set: ResultSet, marks: LineMarks, session: SetSession): Record<string, unknown> {
  const { output } = set;
  const kept = new Set(marks.kept.map((line) => line.id));
  const base = {
    interactionId: set.id,
    mode: set.modeLabel,
    tone: set.toneLabel,
    adjustment: set.adjustment,
    direction: set.direction ?? null,
    fix: set.fix ?? null,
    howYouKnowHer: session.context,
    username: session.username,
    model: `${set.usedKey.provider} / ${set.usedKey.model}`,
    promptVersion: set.promptVersion ?? null,
    seconds: Math.round(set.durationMs / 100) / 10,
    screenType: output.screenType,
    noticed: output.noticed,
  };

  let answer: Record<string, unknown>;
  if (output.kind === 'lines') {
    answer = {
      read: output.read ?? null,
      lines: output.lines.map((line, index) => {
        const id = set.lineIds[index];
        return {
          text: line.text,
          hook: line.hook,
          move: line.move ?? null,
          liked: Boolean(id && marks.liked[id]),
          notForMe: (id && marks.feedback[id]) || null,
          copied: Boolean(id) && id === marks.copiedLineId,
          saved: Boolean(id) && kept.has(id),
        };
      }),
    };
  } else if (output.kind === 'analysis') {
    answer = {
      interest: output.interest,
      signals: output.signals,
      advice: output.advice,
      suggestedReply: output.suggestedReply,
    };
  } else {
    answer = { declined: output.reason };
  }

  return { ...base, ...answer, request: set.request ?? null };
}

/** The whole context of a ticket: where it was sent from, the app, and the set if any. */
export function ticketContext(
  where: 'results' | 'settings',
  app: AppInfo,
  set: Record<string, unknown> | null,
): Record<string, unknown> {
  return { where, app, ...(set ? { set } : {}) };
}

/** What the screen says is attached, in plain words. */
export function includedItems(app: AppInfo, set: ResultSet | null, withScreenshot: boolean): string[] {
  const items: string[] = [];
  if (set) {
    const count = set.output.kind === 'lines' ? `${set.output.lines.length} lines` : set.output.kind;
    items.push(
      `This set: ${[set.toneLabel, set.modeLabel].filter(Boolean).join(' · ')}, ${count}, with what you did with each`,
    );
    items.push(`The options you picked, and how you know her`);
    items.push(`The model that answered (${set.usedKey.model}) and the rules version`);
    items.push('What Banter noticed, and the request it sent');
  }
  if (withScreenshot) items.push('The screenshot');
  const platform = ({ ios: 'iOS', android: 'Android' } as Record<string, string>)[app.platform] ?? app.platform;
  items.push(`Banter ${app.version} on ${platform} ${app.os}`);
  items.push('Your email, from your login, so the answer can find you');
  return items;
}
