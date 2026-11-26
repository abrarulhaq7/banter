import { groupShots, tonesTried, type InteractionWithLines } from '@/history';

const set = (id: string, path: string | null, at: string, extra: Partial<InteractionWithLines> = {}) =>
  ({ id, screenshot_path: path, created_at: at, tone_label: 'Casual', mode_id: 'story_reply', lines: [], ...extra }) as unknown as InteractionWithLines;

const line = (extra: object) => ({ id: 'l', copied_at: null, kept_at: null, result: null, ...extra }) as InteractionWithLines['lines'][number];

describe('groupShots', () => {
  it('puts sets made from the same screenshot together, newest first', () => {
    const shots = groupShots([
      set('c', 'u/two.jpg', '2026-11-25T12:00:00Z'),
      set('b', 'u/one.jpg', '2026-11-25T11:00:00Z', { tone_label: 'Flirty' }),
      set('a', 'u/one.jpg', '2026-11-25T10:00:00Z'),
    ]);

    expect(shots.map((shot) => [shot.id, shot.sets.map((item) => item.id)])).toEqual([
      ['c', ['c']],
      ['a', ['b', 'a']],
    ]);
    expect(shots[1].latestAt).toBe('2026-11-25T11:00:00Z');
    expect(shots[1].screenshotPath).toBe('u/one.jpg');
  });

  it('names a group by its oldest set, so the name survives new sets', () => {
    const before = groupShots([set('a', 'u/one.jpg', '2026-11-25T10:00:00Z')]);
    const after = groupShots([set('b', 'u/one.jpg', '2026-11-25T11:00:00Z'), set('a', 'u/one.jpg', '2026-11-25T10:00:00Z')]);
    expect(after[0].id).toBe(before[0].id);
  });

  it('keeps sets without a screenshot apart', () => {
    const shots = groupShots([set('b', null, '2026-11-25T11:00:00Z'), set('a', null, '2026-11-25T10:00:00Z')]);
    expect(shots.map((shot) => shot.id)).toEqual(['b', 'a']);
  });

  it.each([
    ['unused', [line({})]],
    ['sent', [line({ copied_at: '2026-11-25T10:00:00Z' })]],
    ['no_reply', [line({ copied_at: '2026-11-25T10:00:00Z', result: 'no_reply' })]],
    ['replied', [line({ result: 'no_reply' }), line({ result: 'replied' })]],
  ] as const)('reports "%s" for the screenshot as a whole', (status, lines) => {
    const [shot] = groupShots([set('a', 'u/one.jpg', '2026-11-25T10:00:00Z', { lines: [...lines] })]);
    expect(shot.status).toBe(status);
  });

  it('lists the tones tried, oldest first, once each', () => {
    const [shot] = groupShots([
      set('c', 'u/one.jpg', '2026-11-25T12:00:00Z', { tone_label: 'Flirty' }),
      set('b', 'u/one.jpg', '2026-11-25T11:00:00Z', { tone_label: null, mode_id: 'analyse' }),
      set('a', 'u/one.jpg', '2026-11-25T10:00:00Z', { tone_label: 'Flirty' }),
    ]);
    expect(tonesTried(shot, () => 'Analyse')).toBe('Flirty, Analyse');
  });
});
