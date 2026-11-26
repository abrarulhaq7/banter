import type { InteractionWithLines } from './history-repo';

/** How the lines written for one screenshot went, taken together. */
export type ShotStatus = 'replied' | 'no_reply' | 'sent' | 'unused';

/** Everything made from one screenshot: the sets of lines, newest first. */
export type Shot = {
  /** Id of the oldest set. It never changes when more sets are made from the screenshot. */
  id: string;
  screenshotPath: string | null;
  /** Newest first. */
  sets: InteractionWithLines[];
  /** When the newest set was made. */
  latestAt: string;
  status: ShotStatus;
};

function statusOf(sets: InteractionWithLines[]): ShotStatus {
  const lines = sets.flatMap((set) => set.lines);
  if (lines.some((line) => line.result === 'replied')) return 'replied';
  if (lines.some((line) => line.result === 'no_reply')) return 'no_reply';
  if (lines.some((line) => line.copied_at)) return 'sent';
  return 'unused';
}

/**
 * Groups a person's interactions (newest first) by the screenshot they were made from.
 * An interaction saved without a screenshot is a group of its own.
 */
export function groupShots(interactions: InteractionWithLines[]): Shot[] {
  const groups = new Map<string, InteractionWithLines[]>();
  for (const interaction of interactions) {
    const key = interaction.screenshot_path ?? `alone:${interaction.id}`;
    const group = groups.get(key);
    if (group) group.push(interaction);
    else groups.set(key, [interaction]);
  }
  return [...groups.values()].map((sets) => ({
    id: sets[sets.length - 1].id,
    screenshotPath: sets[0].screenshot_path,
    sets,
    latestAt: sets[0].created_at,
    status: statusOf(sets),
  }));
}

/** The names of the tones tried on a screenshot, oldest first, without repeats. */
export function tonesTried(shot: Shot, fallback: (modeId: string) => string): string {
  const names = [...shot.sets].reverse().map((set) => set.tone_label ?? fallback(set.mode_id));
  return [...new Set(names)].join(', ');
}
