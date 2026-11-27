import type { LineFeedbackId } from '@/lib/database.types';

import type { InteractionWithLines } from './history-repo';

/** What the user's choices so far say about their taste, for the prompt. */
export type Taste = {
  /** Lines they chose to send, best first: answered ones before the rest. */
  liked: string[];
  /** Lines they marked as not for them, newest first, with the reason. */
  disliked: { text: string; reason: LineFeedbackId }[];
  /** Their reasons, counted per tone (by the tone's name), over the latest interactions. */
  marksByTone: Record<string, Partial<Record<LineFeedbackId, number>>>;
};

export const NO_TASTE: Taste = { liked: [], disliked: [], marksByTone: {} };

/** The marks on one tone, most frequent first. */
export function marksFor(taste: Taste, toneLabel: string | null | undefined): { reason: LineFeedbackId; count: number }[] {
  const counts = toneLabel ? taste.marksByTone[toneLabel] : undefined;
  if (!counts) return [];
  return (Object.entries(counts) as [LineFeedbackId, number][])
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}
const LIKED_MAX = 5;
const DISLIKED_MAX = 3;

/**
 * Picks, from the latest interactions with anyone (newest first), the lines that show the
 * user's taste. A line that got a reply counts most; a copied line that got no reply does
 * not count as liked. Sets made for the screenshot being worked on are left out: the prompt
 * already lists those.
 */
export function buildTaste(interactions: InteractionWithLines[], skip: ReadonlySet<string> = new Set()): Taste {
  const lines = interactions.filter((row) => !skip.has(row.id)).flatMap((row) => row.lines);

  const seen = new Set<string>();
  const unique = (text: string) => {
    const key = text.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };

  const replied = lines.filter((line) => line.result === 'replied');
  const copied = lines.filter((line) => line.copied_at && line.result !== 'replied' && line.result !== 'no_reply');
  const liked = [...replied, ...copied]
    .map((line) => line.text)
    .filter(unique)
    .slice(0, LIKED_MAX);

  const disliked = lines
    .filter((line): line is typeof line & { feedback: LineFeedbackId } => Boolean(line.feedback))
    .map((line) => ({ text: line.text, reason: line.feedback }))
    .slice(0, DISLIKED_MAX);

  const marksByTone: Taste['marksByTone'] = {};
  for (const row of interactions) {
    if (!row.tone_label) continue;
    for (const item of row.lines) {
      if (!item.feedback) continue;
      const counts = (marksByTone[row.tone_label] ??= {});
      counts[item.feedback] = (counts[item.feedback] ?? 0) + 1;
    }
  }

  return { liked, disliked, marksByTone };
}
