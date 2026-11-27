import { goalsFor, pickFor, type Answers } from '@/generate/quick-questions';

describe('pickFor', () => {
  it.each<[Answers['kind'], Answers['context'], Answers['goal'], string, string]>([
    // What it is, how he knows her, what he wants → the tone and where a chat goes.
    ['story_reply', null, 'start', 'casual', 'keep_going'],
    ['opener', 'stranger', 'start', 'mysterious', 'keep_going'],
    ['reply', 'already_talking', 'start', 'casual', 'keep_going'],
    ['story_reply', 'stranger', 'laugh', 'funny', 'keep_going'],
    ['story_reply', 'mutual_follow', 'laugh', 'funny', 'keep_going'],
    ['story_reply', 'know_her', 'laugh', 'teasing', 'keep_going'],
    ['story_reply', 'stranger', 'flirt', 'flirty', 'keep_going'],
    ['story_reply', 'know_her', 'heat', 'spicy', 'keep_going'],
    ['reply', 'already_talking', 'heat', 'spicy', 'heat_up'],
    ['reply', 'already_talking', 'bold', 'confident', 'ask_out'],
    ['opener', null, 'bold', 'confident', 'keep_going'],
    ['opener', null, 'curious', 'mysterious', 'keep_going'],
    ['story_reply', null, 'sweet', 'sincere', 'keep_going'],
    ['reply', 'stranger', 'safe', 'safe', 'keep_going'],
  ])('%s, %s, %s → %s, %s', (kind, context, goal, tone, direction) => {
    expect(pickFor({ kind, context, goal })).toEqual({ mode: kind, tone, direction });
  });

  it('never turns up the heat with someone he does not know', () => {
    for (const context of [null, 'stranger', 'mutual_follow'] as const) {
      expect(pickFor({ kind: 'reply', context, goal: 'heat' })).toEqual({
        mode: 'reply',
        tone: 'flirty',
        direction: 'keep_going',
      });
    }
  });
});

describe('goalsFor', () => {
  const values = (...args: Parameters<typeof goalsFor>) => goalsFor(...args).map((goal) => goal.value);

  it('offers Turn up the heat only for someone he knows', () => {
    expect(values('story_reply', null)).not.toContain('heat');
    expect(values('story_reply', 'stranger')).not.toContain('heat');
    expect(values('story_reply', 'mutual_follow')).not.toContain('heat');
    expect(values('story_reply', 'know_her')).toContain('heat');
    expect(values('reply', 'already_talking')).toContain('heat');
  });

  it('names the goals for what the screenshot is', () => {
    expect(goalsFor('opener', null).map((goal) => goal.label)).toEqual([
      'Start talking',
      'Make her laugh',
      'Flirt',
      'Be confident',
      'Keep her curious',
      'Be sweet',
      'Play it safe',
    ]);
    expect(goalsFor('reply', 'already_talking').map((goal) => goal.label)).toEqual([
      'Keep it going',
      'Make her laugh',
      'Flirt',
      'Turn up the heat',
      'Ask her out',
      'Keep her curious',
      'Be sweet',
      'Play it safe',
    ]);
  });
});
