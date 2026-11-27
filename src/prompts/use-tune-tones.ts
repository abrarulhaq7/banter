import { useState } from 'react';

import { profileGoal, useKeys, useProfile } from '@/data';
import { EngineError, GOAL_MIN_WORDS, isEngineError, tuneTones, wordCount, type TuneOutput } from '@/engine';
import { keyCandidates } from '@/generate/key-candidates';
import { keyProblemSaver } from '@/generate/key-problems';

import { usePrompts } from './prompts-provider';
import type { Tone } from './types';

export type TuneDeps = { tune: typeof tuneTones; now: () => Date };

const realDeps: TuneDeps = { tune: tuneTones, now: () => new Date() };

export type TuneState = {
  /** Banter's tones: the ones that will be rewritten. */
  builtIn: Tone[];
  /** Tones the user made: they stay as they are. */
  own: Tone[];
  goal: string | null;
  goalWords: number;
  enoughGoal: boolean;
  hasUsableKey: boolean;
  phase: 'idle' | 'asking' | 'done' | 'saving';
  result: TuneOutput | null;
  error: string | null;
  ask: () => Promise<boolean>;
  /** Saves every rewritten tone. Resolves to true when all were saved. */
  saveAll: () => Promise<boolean>;
};

/** Rewrites Banter's tones for the user from what they wrote in About you. */
export function useTuneTones(overrides: Partial<TuneDeps> = {}): TuneState {
  const deps = { ...realDeps, ...overrides };
  const { keys, models, updateKey, status: keysStatus } = useKeys();
  const { profile } = useProfile();
  const prompts = usePrompts();
  const [phase, setPhase] = useState<TuneState['phase']>('idle');
  const [result, setResult] = useState<TuneOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const builtIn = prompts.tones.filter((tone) => tone.kind !== 'custom');
  const own = prompts.tones.filter((tone) => tone.kind === 'custom');
  const goal = profileGoal(profile);
  const goalWords = wordCount(goal);
  const candidates = keyCandidates(keys, models, deps.now().getTime());

  return {
    builtIn,
    own,
    goal,
    goalWords,
    enoughGoal: goalWords >= GOAL_MIN_WORDS,
    hasUsableKey: keysStatus === 'loading' || candidates.length > 0,
    phase,
    result,
    error,

    async ask() {
      if (phase !== 'idle' || goalWords < GOAL_MIN_WORDS) return false;
      setError(null);
      setPhase('asking');
      try {
        const asked = await deps.tune({
          keys: candidates,
          input: {
            // Always from Banter's own wording, so tuning twice does not drift.
            tones: builtIn.map((tone) => ({
              key: tone.toneId ?? tone.key,
              label: tone.label,
              definition: tone.defaultDefinition ?? tone.definition,
            })),
            profile: {
              goal,
              textingStyle: profile?.texting_style,
              interests: profile?.interests,
              age: profile?.age,
            },
          },
          onKeyProblem: keyProblemSaver(keys, updateKey, deps.now),
        });
        setResult(asked.output);
        setPhase('done');
        return true;
      } catch (caught) {
        const engineError = isEngineError(caught) ? caught : new EngineError('unreadable');
        setError(engineError.message);
        setPhase('idle');
        return false;
      }
    },

    async saveAll() {
      if (!result) return false;
      setError(null);
      setPhase('saving');
      const saved = await prompts.saveToneDefinitions(
        result.tones.map((tone) => ({ toneId: tone.key, definition: tone.definition })),
      );
      setPhase('done');
      if (!saved.ok) setError(saved.message);
      return saved.ok;
    },
  };
}
