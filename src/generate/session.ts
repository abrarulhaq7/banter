import type {
  Adjustment,
  ContextId,
  EngineErrorKind,
  GenerationResult,
  ModeId,
  ModelOutput,
  ToneId,
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
  /** Null for Analyse. */
  toneLabel: string | null;
  adjustment: Adjustment | null;
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
  tone: ToneId;
  context: ContextId | null;
  /** Newest first. */
  sets: ResultSet[];
  kept: KeptLine[];
  phase: 'idle' | 'loadingScreenshot' | 'generating';
  error: SessionError | null;
  /** The line that was copied last, to show "Copied" on it. */
  copiedLineId: string | null;
};

export type SessionAction =
  | { type: 'screenshotLoading' }
  | { type: 'screenshotReady'; screenshot: PreparedScreenshot }
  | { type: 'screenshotFailed'; message: string | null }
  | { type: 'setMode'; mode: ModeId }
  | { type: 'setTone'; tone: ToneId }
  | { type: 'setContext'; context: ContextId | null }
  /** Fills in the context remembered for this person, without the toggle behaviour. */
  | { type: 'rememberContext'; context: ContextId }
  | { type: 'setUsername'; username: string }
  | { type: 'generateStarted' }
  | { type: 'generateSucceeded'; set: ResultSet }
  | { type: 'generateFailed'; error: SessionError }
  | { type: 'toggleKeep'; line: KeptLine }
  | { type: 'copied'; lineId: string }
  | { type: 'dismissError' };

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
      return { ...state, context: state.context ?? action.context };
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

/** The full name of a set: "Flirty · Story reply · Shorter". */
export function setHeading(set: Pick<ResultSet, 'toneLabel' | 'modeLabel' | 'adjustment'>): string {
  return [setLabel(set), set.adjustment ? ADJUSTMENT_LABEL[set.adjustment] : null].filter(Boolean).join(' · ');
}

/** The short name of a set, for the chips that switch between sets: "Flirty · Shorter". */
export function setChipLabel(set: Pick<ResultSet, 'toneLabel' | 'modeLabel' | 'adjustment'>): string {
  return [set.toneLabel ?? set.modeLabel, set.adjustment ? ADJUSTMENT_LABEL[set.adjustment] : null]
    .filter(Boolean)
    .join(' · ');
}
