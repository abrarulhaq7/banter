import { DEFAULT_MODES, type MemoryItem, type ModeId } from '@/engine';

import type { InteractionWithLines } from './history-repo';

/** How many earlier interactions go into a prompt (PLAN.md section 6). */
export const MEMORY_SIZE = 5;

export type Memory = {
  items: MemoryItem[];
  /**
   * The newest line that was copied and has no result yet. The model is asked to look
   * for it in a chat screenshot; its answer sets this line's result.
   */
  awaitingReplyLineId: string | null;
};

/**
 * Turns the newest interactions with a person (newest first) into prompt memory.
 *
 * `sameScreenshot` holds the ids of the sets already made for the screenshot being worked
 * on. Those are options the sender is still choosing between, not messages she has seen:
 * a line copied from one of them a moment ago is never "waiting for a reply".
 */
export function buildMemory(
  interactions: InteractionWithLines[],
  sameScreenshot: ReadonlySet<string> = new Set(),
): Memory {
  const recent = interactions.slice(0, MEMORY_SIZE);

  let awaitingReplyLineId: string | null = null;
  for (const interaction of recent) {
    if (sameScreenshot.has(interaction.id)) continue;
    const waiting = interaction.lines
      .filter((line) => line.copied_at && !line.result)
      .sort((a, b) => (b.copied_at ?? '').localeCompare(a.copied_at ?? ''))[0];
    if (waiting) {
      awaitingReplyLineId = waiting.id;
      break;
    }
  }

  const items = recent
    // An interaction with no lines (an analysis, a decline) has nothing to avoid repeating.
    .filter((interaction) => interaction.lines.length > 0)
    .map((interaction) => ({
      at: interaction.created_at,
      modeLabel: DEFAULT_MODES[interaction.mode_id as ModeId]?.label ?? interaction.mode_id,
      toneLabel: interaction.tone_label,
      ...(sameScreenshot.has(interaction.id) ? { sameScreenshot: true } : {}),
      lines: interaction.lines.map((line) => ({
        text: line.text,
        copied: line.copied_at !== null,
        result: line.result,
        awaitingReply: line.id === awaitingReplyLineId,
      })),
    }));

  return { items, awaitingReplyLineId };
}
