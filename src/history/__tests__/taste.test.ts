import { buildTaste, type InteractionWithLines } from '@/history';
import type { LineRow } from '@/lib/database.types';

const line = (text: string, extra: Partial<LineRow> = {}): LineRow =>
  ({ id: text, text, copied_at: null, kept_at: null, result: null, feedback: null, ...extra }) as LineRow;
const set = (id: string, lines: LineRow[]) => ({ id, lines }) as unknown as InteractionWithLines;

describe('buildTaste', () => {
  it('likes answered lines first, then copied ones, never copied lines that got no reply', () => {
    const taste = buildTaste([
      set('a', [line('copied one', { copied_at: 't' }), line('ignored')]),
      set('b', [line('answered', { copied_at: 't', result: 'replied' }), line('silence', { copied_at: 't', result: 'no_reply' })]),
    ]);

    expect(taste.liked).toEqual(['answered', 'copied one']);
  });

  it('keeps at most five liked lines, without repeats', () => {
    const many = Array.from({ length: 8 }, (_, n) => line(`line ${n % 6}`, { copied_at: 't', id: `id-${n}` }));

    expect(buildTaste([set('a', many)]).liked).toEqual(['line 0', 'line 1', 'line 2', 'line 3', 'line 4']);
  });

  it('lists the newest disliked lines with their reason, at most three', () => {
    const taste = buildTaste([
      set('a', [line('one', { feedback: 'cringe' }), line('two', { feedback: 'too_much' })]),
      set('b', [line('three', { feedback: 'not_me' }), line('four', { feedback: 'too_long' })]),
    ]);

    expect(taste.disliked).toEqual([
      { text: 'one', reason: 'cringe' },
      { text: 'two', reason: 'too_much' },
      { text: 'three', reason: 'not_me' },
    ]);
  });

  it('leaves out the sets of the screenshot in hand', () => {
    const taste = buildTaste([set('now', [line('just made', { copied_at: 't' })]), set('old', [line('before', { copied_at: 't' })])], new Set(['now']));

    expect(taste.liked).toEqual(['before']);
  });

  it('works on lines saved before feedback existed', () => {
    const old = { id: 'x', text: 'old', copied_at: 't', kept_at: null, result: null } as unknown as LineRow;

    expect(buildTaste([set('a', [old])])).toEqual({ liked: ['old'], disliked: [] });
  });
});
