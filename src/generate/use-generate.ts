import * as Clipboard from 'expo-clipboard';
import { useReducer, useRef } from 'react';

import { useKeys, useProfile } from '@/data';
import {
  DEFAULT_CORE,
  DEFAULT_MODES,
  DEFAULT_TONES,
  EngineError,
  generate as runEngine,
  isEngineError,
  type Adjustment,
  type ContextId,
  type GenerateOptions,
  type GenerationResult,
  type ModeId,
  type SenderProfile,
  type ToneId,
} from '@/engine';
import type { ProfileRow } from '@/lib/database.types';
import { getLatestScreenshot, pickFromGallery } from '@/screenshot';
import type { ScreenshotResult } from '@/screenshot/types';

import { keyCandidates } from './key-candidates';
import {
  adjustableLines,
  initialSession,
  sessionReducer,
  type KeptLine,
  type ResultSet,
  type SessionState,
} from './session';

/** The outside world the Generate screen talks to. Tests replace all of it. */
export type GenerateDeps = {
  getLatestScreenshot: () => Promise<ScreenshotResult>;
  pickFromGallery: () => Promise<ScreenshotResult>;
  runEngine: (options: GenerateOptions) => Promise<GenerationResult>;
  copy: (text: string) => Promise<unknown>;
};

const realDeps: GenerateDeps = {
  getLatestScreenshot,
  pickFromGallery,
  runEngine,
  copy: (text) => Clipboard.setStringAsync(text),
};

function senderProfile(profile: ProfileRow | null): SenderProfile | null {
  if (!profile) return null;
  return {
    name: profile.display_name,
    age: profile.age,
    city: profile.city,
    work: profile.work,
    interests: profile.interests,
    textingStyle: profile.texting_style,
  };
}

export type GenerateController = SessionState & {
  /** False when the user has no key that can be tried right now. */
  hasUsableKey: boolean;
  useLatestScreenshot: () => Promise<void>;
  pickScreenshot: () => Promise<void>;
  setMode: (mode: ModeId) => void;
  setTone: (tone: ToneId) => void;
  setContext: (context: ContextId) => void;
  generate: () => Promise<void>;
  adjust: (kind: Adjustment) => Promise<void>;
  copyLine: (lineId: string, text: string) => Promise<void>;
  toggleKeep: (line: KeptLine) => void;
  dismissError: () => void;
};

export function useGenerate(overrides: Partial<GenerateDeps> = {}): GenerateController {
  const deps = { ...realDeps, ...overrides };
  const { keys, models, updateKey, status: keysStatus } = useKeys();
  const { profile } = useProfile();
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  const nextSetNumber = useRef(1);

  const candidates = keyCandidates(keys, models);

  const loadScreenshot = async (source: () => Promise<ScreenshotResult>) => {
    if (state.phase !== 'idle') return;
    dispatch({ type: 'screenshotLoading' });
    const result = await source();
    if (result.ok) dispatch({ type: 'screenshotReady', screenshot: result.screenshot });
    else dispatch({ type: 'screenshotFailed', message: result.reason === 'cancelled' ? null : result.message });
  };

  const run = async (adjustment: { kind: Adjustment; previousLines: string[] } | null, from?: ResultSet) => {
    if (state.phase !== 'idle' || !state.screenshot) return;

    // An adjustment keeps the mode and tone of the set it adjusts.
    const mode = from?.mode ?? state.mode;
    const toneLabel = from ? from.toneLabel : mode === 'analyse' ? null : DEFAULT_TONES[state.tone].label;
    const tone =
      mode === 'analyse'
        ? null
        : (Object.values(DEFAULT_TONES).find((item) => item.label === toneLabel) ?? DEFAULT_TONES[state.tone]);

    dispatch({ type: 'generateStarted' });
    try {
      const result = await deps.runEngine({
        keys: candidates,
        image: state.screenshot.image,
        prompt: {
          core: DEFAULT_CORE,
          mode,
          modeInstruction: DEFAULT_MODES[mode].instruction,
          tone,
          context: state.context,
          profile: senderProfile(profile),
          adjustment,
        },
        // Save what was learned about a key, so the Keys screen shows it and it is skipped.
        onKeyProblem: async ({ keyId, status, message }) => {
          await updateKey(keyId, {
            status,
            last_error: message,
            limited_at: status === 'limited' ? new Date().toISOString() : null,
          });
        },
      });

      // A key that had been resting after a limit worked again: it is active once more.
      if (keys.find((key) => key.id === result.usedKey.id)?.status === 'limited') {
        void updateKey(result.usedKey.id, { status: 'active', last_error: null, limited_at: null });
      }

      dispatch({
        type: 'generateSucceeded',
        set: {
          id: `set-${nextSetNumber.current++}`,
          mode,
          modeLabel: DEFAULT_MODES[mode].label,
          toneLabel: tone?.label ?? null,
          adjustment: adjustment?.kind ?? null,
          output: result.output,
          usedKey: result.usedKey,
          durationMs: result.durationMs,
        },
      });
    } catch (error) {
      // The engine only throws EngineError, but a screen must never crash on a surprise.
      const engineError = isEngineError(error) ? error : new EngineError('unreadable');
      dispatch({ type: 'generateFailed', error: { kind: engineError.kind, message: engineError.message } });
    }
  };

  return {
    ...state,
    hasUsableKey: keysStatus === 'loading' || candidates.length > 0,
    useLatestScreenshot: () => loadScreenshot(deps.getLatestScreenshot),
    pickScreenshot: () => loadScreenshot(deps.pickFromGallery),
    setMode: (mode) => dispatch({ type: 'setMode', mode }),
    setTone: (tone) => dispatch({ type: 'setTone', tone }),
    setContext: (context) => dispatch({ type: 'setContext', context }),
    generate: () => run(null),
    adjust: async (kind) => {
      const newest = state.sets[0];
      const previousLines = adjustableLines(newest);
      if (previousLines) await run({ kind, previousLines }, newest);
    },
    copyLine: async (lineId, text) => {
      await deps.copy(text);
      dispatch({ type: 'copied', lineId });
    },
    toggleKeep: (line) => dispatch({ type: 'toggleKeep', line }),
    dismissError: () => dispatch({ type: 'dismissError' }),
  };
}
