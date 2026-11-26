import { buildMemory, type InteractionWithLines } from '@/history';
import { CONTEXT_LABELS, timeAgo } from '@/history/labels';
import type { LineRow } from '@/lib/database.types';

const line = (id: string, overrides: Partial<LineRow> = {}): LineRow => ({
  id,
  user_id: 'u',
  interaction_id: 'i',
  position: 1,
  text: `Line ${id}`,
  hook: null,
  copied_at: null,
  kept_at: null,
  result: null,
  result_at: null,
  created_at: '2026-11-25T12:00:00Z',
  ...overrides,
});

const interaction = (id: string, at: string, lines: LineRow[], overrides: Partial<InteractionWithLines> = {}) =>
  ({
    id,
    created_at: at,
    mode_id: 'story_reply',
    tone_label: 'Casual',
    lines,
    ...overrides,
  }) as InteractionWithLines;

describe('buildMemory', () => {
  it('describes each earlier interaction with what was sent and how it went', () => {
    const memory = buildMemory([
      interaction('i2', '2026-11-22T10:00:00Z', [
        line('a', { copied_at: '2026-11-22T10:01:00Z', result: 'replied' }),
        line('b'),
      ]),
      interaction('i1', '2026-11-20T10:00:00Z', [line('c', { copied_at: '2026-11-20T10:01:00Z', result: 'no_reply' })], {
        mode_id: 'opener',
        tone_label: 'Flirty',
      }),
    ]);

    expect(memory.items).toEqual([
      {
        at: '2026-11-22T10:00:00Z',
        modeLabel: 'Story reply',
        toneLabel: 'Casual',
        lines: [
          { text: 'Line a', copied: true, result: 'replied', awaitingReply: false },
          { text: 'Line b', copied: false, result: null, awaitingReply: false },
        ],
      },
      {
        at: '2026-11-20T10:00:00Z',
        modeLabel: 'Opener',
        toneLabel: 'Flirty',
        lines: [{ text: 'Line c', copied: true, result: 'no_reply', awaitingReply: false }],
      },
    ]);
    expect(memory.awaitingReplyLineId).toBeNull();
  });

  it('uses only the five newest interactions', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      interaction(`i${index}`, `2026-11-${20 - index}T10:00:00Z`, [line(`l${index}`)]),
    );
    expect(buildMemory(many).items).toHaveLength(5);
  });

  it('picks the newest copied line with no result as the one to look for in a chat', () => {
    const memory = buildMemory([
      interaction('newest', '2026-11-23T10:00:00Z', [line('not-used')]),
      interaction('middle', '2026-11-22T10:00:00Z', [
        line('older-copy', { copied_at: '2026-11-22T10:01:00Z' }),
        line('newer-copy', { copied_at: '2026-11-22T10:05:00Z' }),
      ]),
      interaction('oldest', '2026-11-20T10:00:00Z', [line('ancient', { copied_at: '2026-11-20T10:01:00Z' })]),
    ]);

    expect(memory.awaitingReplyLineId).toBe('newer-copy');
    const flagged = memory.items.flatMap((item) => item.lines).filter((item) => item.awaitingReply);
    expect(flagged.map((item) => item.text)).toEqual(['Line newer-copy']);
  });

  it('leaves out interactions with no lines, such as an analysis without a reply', () => {
    const memory = buildMemory([
      interaction('analysis', '2026-11-23T10:00:00Z', [], { mode_id: 'analyse' }),
      interaction('lines', '2026-11-22T10:00:00Z', [line('a')]),
    ]);
    expect(memory.items.map((item) => item.at)).toEqual(['2026-11-22T10:00:00Z']);
  });

  it('is empty for someone new', () => {
    expect(buildMemory([])).toEqual({ items: [], awaitingReplyLineId: null });
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-25T12:00:00Z');

  it.each([
    ['2026-11-25T11:59:40Z', 'just now'],
    ['2026-11-25T11:59:00Z', '1 minute ago'],
    ['2026-11-25T11:15:00Z', '45 minutes ago'],
    ['2026-11-25T09:00:00Z', '3 hours ago'],
    ['2026-11-24T11:00:00Z', '1 day ago'],
    ['2026-11-05T12:00:00Z', '20 days ago'],
    ['2026-09-01T12:00:00Z', '2026-09-01'],
  ])('%s is "%s"', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });

  it('gives nothing for a missing or broken date', () => {
    expect(timeAgo(null, now)).toBeNull();
    expect(timeAgo('not a date', now)).toBeNull();
  });

  it('has a label for every context', () => {
    expect(Object.keys(CONTEXT_LABELS)).toEqual(['stranger', 'mutual_follow', 'know_her', 'already_talking']);
  });
});
