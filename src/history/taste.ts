import type { LineFeedbackId } from '@/lib/database.types';

import type { InteractionWithLines } from './history-repo';

/** What the user's choices so far say about their taste, for the prompt. */
export type Taste = {
  /** Lines they chose to send, best first: answered ones before the rest. */
  liked: string[];
  /** Lines they marked as not for them, newest first, with the reason. */
  disliked: { text: string; reason: LineFeedbackId }[];
};

export const NO_TASTE: Taste = { liked: [], disliked: [] };
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

  return { liked, disliked };
}
