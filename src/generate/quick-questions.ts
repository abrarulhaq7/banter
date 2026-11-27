import type { ContextId, Direction, ModeId, ToneId } from '@/engine';

/**
 * The quick questions asked when a screenshot is chosen: what it is, how he knows her, and
 * what he wants. The answers set the mode, the tone and, for a chat, where to take it, the
 * way the Guide's best setups do (src/components/guide/guide-content.ts). He can change any
 * of it afterwards.
 */

/** What the screenshot shows. Analyse is not asked about: it has no tone. */
export type ScreenKind = Exclude<ModeId, 'analyse'>;

export const SCREEN_KINDS: { value: ScreenKind; label: string }[] = [
  { value: 'story_reply', label: 'Her story' },
  { value: 'opener', label: 'Her profile' },
  { value: 'reply', label: 'Your chat' },
];

/** What he wants the message to do. */
export type Goal = 'start' | 'laugh' | 'flirt' | 'heat' | 'bold' | 'curious' | 'sweet' | 'safe';

/**
 * Know her and Already talking allow compliments on her looks and real heat; anything else,
 * not set included, counts as a stranger (core rules: How you know her).
 */
export function isClose(context: ContextId | null): boolean {
  return context === 'know_her' || context === 'already_talking';
}

/** The goals that fit, with labels for what the screenshot is. Heat only when they are close. */
export function goalsFor(kind: ScreenKind, context: ContextId | null): { value: Goal; label: string }[] {
  const chat = kind === 'reply';
  return [
    { value: 'start' as const, label: chat ? 'Keep it going' : 'Start talking' },
    { value: 'laugh' as const, label: 'Make her laugh' },
    { value: 'flirt' as const, label: 'Flirt' },
    ...(isClose(context) ? [{ value: 'heat' as const, label: 'Turn up the heat' }] : []),
    { value: 'bold' as const, label: chat ? 'Ask her out' : 'Be confident' },
    { value: 'curious' as const, label: 'Keep her curious' },
    { value: 'sweet' as const, label: 'Be sweet' },
    { value: 'safe' as const, label: 'Play it safe' },
  ];
}

export type Answers = { kind: ScreenKind; context: ContextId | null; goal: Goal };
export type QuickPick = { mode: ScreenKind; tone: ToneId; direction: Direction };

/** The setup the answers point to. */
export function pickFor({ kind, context, goal }: Answers): QuickPick {
  const close = isClose(context);
  const chat = kind === 'reply';
  const tone = ((): ToneId => {
    switch (goal) {
      // A first message works best when it makes her curious; elsewhere, easy and natural.
      case 'start':
        return kind === 'opener' ? 'mysterious' : 'casual';
      case 'laugh':
        return close ? 'teasing' : 'funny';
      case 'flirt':
        return 'flirty';
      // Spicy is for someone he knows; with anyone else it stays flirty.
      case 'heat':
        return close ? 'spicy' : 'flirty';
      case 'bold':
        return 'confident';
      case 'curious':
        return 'mysterious';
      case 'sweet':
        return 'sincere';
      case 'safe':
        return 'safe';
    }
  })();
  const direction: Direction =
    chat && goal === 'heat' && close ? 'heat_up' : chat && goal === 'bold' ? 'ask_out' : 'keep_going';
  return { mode: kind, tone, direction };
}
