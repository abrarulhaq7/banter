import { useState } from 'react';

import { useKeys } from '@/data';
import { EngineError, isEngineError, learnTone, type LearnInput, type LearnOutput } from '@/engine';
import { keyCandidates } from '@/generate/key-candidates';
import { getLatestScreenshot, pickFromGallery } from '@/screenshot';
import type { PreparedScreenshot, ScreenshotResult } from '@/screenshot/types';

export type LearnDeps = {
  learn: typeof learnTone;
  getLatestScreenshot: () => Promise<ScreenshotResult>;
  pickFromGallery: () => Promise<ScreenshotResult>;
  now: () => Date;
};

const realDeps: LearnDeps = { learn: learnTone, getLatestScreenshot, pickFromGallery, now: () => new Date() };

export type LearnState = {
  screenshot: PreparedScreenshot | null;
  text: string;
  setText: (text: string) => void;
  useLatest: () => Promise<void>;
  pick: () => Promise<void>;
  clearScreenshot: () => void;
  phase: 'idle' | 'loading' | 'asking' | 'done';
  result: LearnOutput | null;
  error: string | null;
  hasUsableKey: boolean;
  canAsk: boolean;
  ask: () => Promise<void>;
  /** Back to choosing an example. */
  startOver: () => void;
};

/** The example (a screenshot or pasted text) and the request that learns its style. */
export function useLearnTone(overrides: Partial<LearnDeps> = {}): LearnState {
  const deps = { ...realDeps, ...overrides };
  const { keys, models, updateKey, status: keysStatus } = useKeys();
  const [screenshot, setScreenshot] = useState<PreparedScreenshot | null>(null);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<LearnState['phase']>('idle');
  const [result, setResult] = useState<LearnOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = keyCandidates(keys, models, deps.now().getTime());
  const hasUsableKey = keysStatus === 'loading' || candidates.length > 0;

  const load = async (source: () => Promise<ScreenshotResult>) => {
    setError(null);
    setPhase('loading');
    const loaded = await source();
    setPhase('idle');
    if (loaded.ok) {
      setScreenshot(loaded.screenshot);
      setText('');
    } else if (loaded.reason !== 'cancelled') {
      setError(loaded.message);
    }
  };

  const input: LearnInput | null = screenshot
    ? { kind: 'image', image: screenshot.image }
    : text.trim()
      ? { kind: 'text', text: text.trim() }
      : null;

  return {
    screenshot,
    text,
    setText: (next) => {
      setText(next);
      if (next.trim()) setScreenshot(null);
    },
    useLatest: () => load(deps.getLatestScreenshot),
    pick: () => load(deps.pickFromGallery),
    clearScreenshot: () => setScreenshot(null),
    phase,
    result,
    error,
    hasUsableKey,
    canAsk: input !== null && hasUsableKey && phase === 'idle',

    async ask() {
      if (!input || phase !== 'idle') return;
      setError(null);
      setPhase('asking');
      try {
        const asked = await deps.learn({
          keys: candidates,
          input,
          onKeyProblem: async ({ keyId, status, message }) => {
            await updateKey(keyId, {
              status,
              last_error: message,
              limited_at: status === 'limited' ? deps.now().toISOString() : null,
            });
          },
        });
        setResult(asked.output);
        setPhase('done');
      } catch (caught) {
        const engineError = isEngineError(caught) ? caught : new EngineError('unreadable');
        setError(engineError.message);
        setPhase('idle');
      }
    },

    startOver: () => {
      setResult(null);
      setPhase('idle');
      setError(null);
    },
  };
}
