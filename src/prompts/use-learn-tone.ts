import { useState } from 'react';

import { useKeys } from '@/data';
import {
  EngineError,
  MAX_EXAMPLE_IMAGES,
  isEngineError,
  learnTone,
  type LearnInput,
  type LearnOutput,
} from '@/engine';
import { keyCandidates } from '@/generate/key-candidates';
import { keyProblemSaver } from '@/generate/key-problems';
import { getLatestScreenshot, pickPictures } from '@/screenshot';
import { SCREENSHOT_MESSAGES, type PreparedScreenshot, type ScreenshotResult } from '@/screenshot/types';

export type LearnDeps = {
  learn: typeof learnTone;
  getLatestScreenshot: () => Promise<ScreenshotResult>;
  /** The photo picker: up to `limit` images, an empty list when closed. Throws when one cannot be read. */
  pickPictures: (limit: number) => Promise<PreparedScreenshot[]>;
  now: () => Date;
};

const realDeps: LearnDeps = { learn: learnTone, getLatestScreenshot, pickPictures, now: () => new Date() };

export type LearnState = {
  /** The screenshots chosen, up to three, in the order they were added. */
  screenshots: PreparedScreenshot[];
  /** True while another screenshot can be added. */
  canAddMore: boolean;
  text: string;
  setText: (text: string) => void;
  /** Adds the newest screenshot. */
  useLatest: () => Promise<void>;
  /** Adds screenshots from the photo picker, several at once. */
  pick: () => Promise<void>;
  removeScreenshot: (index: number) => void;
  phase: 'idle' | 'loading' | 'asking' | 'done';
  result: LearnOutput | null;
  error: string | null;
  hasUsableKey: boolean;
  canAsk: boolean;
  ask: () => Promise<void>;
  /** Back to choosing an example. */
  startOver: () => void;
};

/** The examples (screenshots or pasted text) and the request that learns their style. */
export function useLearnTone(overrides: Partial<LearnDeps> = {}): LearnState {
  const deps = { ...realDeps, ...overrides };
  const { keys, models, updateKey, status: keysStatus } = useKeys();
  const [screenshots, setScreenshots] = useState<PreparedScreenshot[]>([]);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<LearnState['phase']>('idle');
  const [result, setResult] = useState<LearnOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = keyCandidates(keys, models, deps.now().getTime());
  const hasUsableKey = keysStatus === 'loading' || candidates.length > 0;
  const room = MAX_EXAMPLE_IMAGES - screenshots.length;

  /** Adds what was chosen, keeping to the most a request can take. Choosing clears pasted text. */
  const add = (more: PreparedScreenshot[]) => {
    if (more.length === 0) return;
    setScreenshots((current) => [...current, ...more].slice(0, MAX_EXAMPLE_IMAGES));
    setText('');
  };

  const useLatest = async () => {
    if (room <= 0) return;
    setError(null);
    setPhase('loading');
    const loaded = await deps.getLatestScreenshot();
    setPhase('idle');
    if (loaded.ok) add([loaded.screenshot]);
    else if (loaded.reason !== 'cancelled') setError(loaded.message);
  };

  const pick = async () => {
    if (room <= 0) return;
    setError(null);
    setPhase('loading');
    try {
      add(await deps.pickPictures(room));
    } catch {
      setError(SCREENSHOT_MESSAGES.failed);
    }
    setPhase('idle');
  };

  const input: LearnInput | null =
    screenshots.length > 0
      ? { kind: 'image', images: screenshots.map((screenshot) => screenshot.image) }
      : text.trim()
        ? { kind: 'text', text: text.trim() }
        : null;

  return {
    screenshots,
    canAddMore: room > 0,
    text,
    setText: (next) => {
      setText(next);
      if (next.trim()) setScreenshots([]);
    },
    useLatest,
    pick,
    removeScreenshot: (index) => setScreenshots((current) => current.filter((_, at) => at !== index)),
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
          onKeyProblem: keyProblemSaver(keys, updateKey, deps.now),
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
