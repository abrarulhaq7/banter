import type {
  Adjustment,
  ContextId,
  Direction,
  LineFeedback,
  EngineErrorKind,
  GenerationResult,
  ModeId,
  ModelOutput,
} from '@/engine';
import type { PreparedScreenshot } from '@/screenshot/types';

/**
 * The state of the Generate screen for one screenshot.
 *
 * Results are never replaced: every generation adds a set above the earlier ones. Lines
 * the user keeps are pinned separately and survive any number of new sets. Choosing a
 * new screenshot starts over.
 */

/** One generation: the answer, and what it was asked with. */
export type ResultSet = {
  /** Also the id of the saved interaction. */
  id: string;
  /**
   * Ids of the saved lines, in order. For an analysis this is the suggested reply, if
   * there is one. Empty for a decline.
   */
  lineIds: string[];
  mode: ModeId;
  modeLabel: string;
  /** The tone it was written in (see `Tone.key`), so an adjustment uses the same one. Null for Analyse. */
  toneKey: string | null;
  /** Null for Analyse. */
  toneLabel: string | null;
  adjustment: Adjustment | null;
  /** Reply only: where the user asked to take the chat. Null for the usual. */
  direction?: Direction | null;
  output: ModelOutput;
  usedKey: GenerationResult['usedKey'];
  durationMs: number;
};

export type KeptLine = {
  /** The saved line's id, so the same line cannot be kept twice. */
  id: string;
  text: string;
  /** Where it came from, for example "Flirty · Story reply". */
  label: string;
};

export type SessionError = {
  kind: EngineErrorKind | 'screenshot';
  message: string;
};

export type SessionState = {
  screenshot: PreparedScreenshot | null;
  /**
   * Who this screenshot is of: read by the AI from the first answer, or typed by the user.
   * Null until then. Everything generated for this screenshot is saved under this person.
   */
  username: string | null;
  mode: ModeId;
  /** The chosen tone's key: one of Banter's tones or one the user made. */
  tone: string;
  context: ContextId | null;
  /** Newest first. */
  sets: ResultSet[];
  kept: KeptLine[];
  phase: 'idle' | 'loadingScreenshot' | 'generating';
  error: SessionError | null;
  /** The line that was copied last, to show "Copied" on it. */
  copiedLineId: string | null;
  /** Reply only: where to take the chat. Back to keep_going with each new screenshot. */
  direction: Direction;
  /** Why the user did not like a line, by line id. */
  feedback: Record<string, LineFeedback>;
};

export type SessionAction =
  | { type: 'screenshotLoading' }
  | { type: 'screenshotReady'; screenshot: PreparedScreenshot }
  | { type: 'screenshotFailed'; message: string | null }
  | { type: 'setMode'; mode: ModeId }
  | { type: 'setTone'; tone: string }
  | { type: 'setContext'; context: ContextId | null }
  /** Fills in the context remembered for this person, without the toggle behaviour. */
  | { type: 'rememberContext'; context: ContextId; replace?: boolean }
  /** Null: not known yet (only before anything was made for the screenshot). */
  | { type: 'setUsername'; username: string | null }
  | { type: 'generateStarted' }
  | { type: 'generateSucceeded'; set: ResultSet }
  | { type: 'generateFailed'; error: SessionError }
  | { type: 'toggleKeep'; line: KeptLine }
  | { type: 'copied'; lineId: string }
  | { type: 'dismissError' }
  | { type: 'setDirection'; direction: Direction }
  | { type: 'setFeedback'; lineId: string; reason: LineFeedback | null }
  /** Back to no screenshot. The chosen mode and tone stay: they are the user's habits. */
  | { type: 'clear' };

export const initialSession: SessionState = {
  screenshot: null,
  username: null,
  mode: 'story_reply',
  tone: 'casual',
  context: null,
  sets: [],
  kept: [],
  phase: 'idle',
  error: null,
  copiedLineId: null,
  direction: 'keep_going',
  feedback: {},
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'screenshotLoading':
      return { ...state, phase: 'loadingScreenshot', error: null };

    case 'screenshotReady':
      // A new screenshot is a new person or moment: earlier lines no longer apply.
      return {
        ...state,
        screenshot: action.screenshot,
        username: null,
        context: null,
        sets: [],
        kept: [],
        copiedLineId: null,
        phase: 'idle',
        error: null,
        // Turning up the heat is a choice about one conversation, not a habit.
        direction: 'keep_going',
        feedback: {},
      };

    case 'screenshotFailed':
      // The screenshot already chosen, and its lines, stay.
      return {
        ...state,
        phase: 'idle',
        error: action.message ? { kind: 'screenshot', message: action.message } : null,
      };

    case 'setMode':
      return { ...state, mode: action.mode };
    case 'setTone':
      return { ...state, tone: action.tone };
    case 'setContext':
      // Tapping the selected context again clears it.
      return { ...state, context: state.context === action.context ? null : action.context };

    case 'generateStarted':
      return { ...state, phase: 'generating', error: null };
    case 'rememberContext':
      return { ...state, context: action.replace ? action.context : (state.context ?? action.context) };
    case 'setUsername':
      return { ...state, username: action.username };

    case 'generateSucceeded':
      return {
        ...state,
        phase: 'idle',
        sets: [action.set, ...state.sets],
        // The first answer that reads a username decides who this screenshot is of.
        username: state.username ?? action.set.output.username,
      };
    case 'generateFailed':
      // Earlier sets and kept lines are untouched by a failure.
      return { ...state, phase: 'idle', error: action.error };

    case 'toggleKeep': {
      const already = state.kept.some((line) => line.id === action.line.id);
      return {
        ...state,
        kept: already
          ? state.kept.filter((line) => line.id !== action.line.id)
          : [...state.kept, action.line],
      };
    }

    case 'copied':
      return { ...state, copiedLineId: action.lineId };
    case 'dismissError':
      return { ...state, error: null };
    case 'setDirection':
      return { ...state, direction: action.direction };
    case 'setFeedback': {
      const feedback = { ...state.feedback };
      if (action.reason) feedback[action.lineId] = action.reason;
      else delete feedback[action.lineId];
      return { ...state, feedback };
    }
    case 'clear':
      // Nothing is lost: every set was saved to history when it arrived.
      return state.phase === 'idle' ? { ...initialSession, mode: state.mode, tone: state.tone } : state;
  }
}

/** The lines of a set that can be adjusted, or null (analysis, declined). */
export function adjustableLines(set: ResultSet | undefined): string[] | null {
  if (!set || set.output.kind !== 'lines') return null;
  return set.output.lines.map((line) => line.text);
}

export function setLabel(set: Pick<ResultSet, 'toneLabel' | 'modeLabel'>): string {
  return [set.toneLabel, set.modeLabel].filter(Boolean).join(' · ');
}

const ADJUSTMENT_LABEL: Record<Adjustment, string> = { new_lines: 'New lines', shorter: 'Shorter', bolder: 'Bolder' };

export const DIRECTION_LABEL: Record<Direction, string> = {
  keep_going: 'Keep it going',
  heat_up: 'Turn up the heat',
  ask_out: 'Ask her out',
};
const DIRECTION_SHORT: Record<Direction, string | null> = { keep_going: null, heat_up: 'Heat', ask_out: 'Ask out' };

type Named = Pick<ResultSet, 'toneLabel' | 'modeLabel' | 'adjustment' | 'direction'>;

/** The full name of a set: "Flirty · Story reply · Shorter", "Spicy · Reply · Turn up the heat". */
export function setHeading(set: Named): string {
  return [
    setLabel(set),
    set.direction && set.direction !== 'keep_going' ? DIRECTION_LABEL[set.direction] : null,
    set.adjustment ? ADJUSTMENT_LABEL[set.adjustment] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The short name of a set, for the chips that switch between sets: "Flirty · Shorter". */
export function setChipLabel(set: Named): string {
  return [
    set.toneLabel ?? set.modeLabel,
    set.direction ? DIRECTION_SHORT[set.direction] : null,
    set.adjustment ? ADJUSTMENT_LABEL[set.adjustment] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
