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
  id: string;
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
  /** `<set id>:<position>`, so the same line cannot be kept twice. */
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
  | { type: 'generateStarted' }
  | { type: 'generateSucceeded'; set: ResultSet }
  | { type: 'generateFailed'; error: SessionError }
  | { type: 'toggleKeep'; line: KeptLine }
  | { type: 'copied'; lineId: string }
  | { type: 'dismissError' };

export const initialSession: SessionState = {
  screenshot: null,
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
    case 'generateSucceeded':
      return { ...state, phase: 'idle', sets: [action.set, ...state.sets] };
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
