import { useEffect, useState } from 'react';

import { profileGoal, useKeys, useProfile } from '@/data';
import {
  EngineError,
  evidenceCount,
  isEngineError,
  suggestTones,
  type ModeId,
  type PersonaliseOutput,
  type SenderProfile,
  type UsedSet,
} from '@/engine';
import { keyCandidates } from '@/generate/key-candidates';
import { useHistory, type InteractionWithLines } from '@/history';

import { usePrompts } from './prompts-provider';

export type PersonaliseDeps = {
  suggest: typeof suggestTones;
  now: () => Date;
};

const realDeps: PersonaliseDeps = { suggest: suggestTones, now: () => new Date() };

export type Evidence = ReturnType<typeof evidenceCount> & { sets: number };

export type PersonaliseState = {
  /** What there is to go on. Null while the history is being read. */
  evidence: Evidence | null;
  /** Set when the history could not be read. */
  historyError: string | null;
  hasUsableKey: boolean;
  phase: 'idle' | 'asking' | 'done';
  result: PersonaliseOutput | null;
  error: string | null;
  reloadHistory: () => Promise<void>;
  ask: () => Promise<boolean>;
};

/** History as the suggestion prompt wants it: lines with a tone, and what became of each. */
export function usedSets(
  interactions: InteractionWithLines[],
  modeLabel: (modeId: string) => string,
): UsedSet[] {
  return interactions
    .filter((row) => row.mode_id !== 'analyse' && row.lines.length > 0)
    .map((row) => ({
      toneLabel: row.tone_label,
      modeLabel: modeLabel(row.mode_id),
      lines: row.lines.map((line) => ({
        text: line.text,
        copied: line.copied_at !== null,
        kept: line.kept_at !== null,
        result: line.result,
        feedback: line.feedback ?? null,
      })),
    }));
}

/** Reads the user's history, and asks one of their keys for tone suggestions on request. */
export function usePersonalise(overrides: Partial<PersonaliseDeps> = {}): PersonaliseState {
  const deps = { ...realDeps, ...overrides };
  const { keys, models, updateKey, status: keysStatus } = useKeys();
  const { profile } = useProfile();
  const history = useHistory();
  const prompts = usePrompts();

  const [sets, setSets] = useState<UsedSet[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [phase, setPhase] = useState<PersonaliseState['phase']>('idle');
  const [result, setResult] = useState<PersonaliseOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sender: SenderProfile = {
    age: profile?.age,
    work: profile?.work,
    interests: profile?.interests,
    textingStyle: profile?.texting_style,
    goal: profileGoal(profile),
  };
  const candidates = keyCandidates(keys, models, deps.now().getTime());

  const loadHistory = async (isCurrent: () => boolean = () => true) => {
    try {
      const rows = await history.recentInteractions();
      if (!isCurrent()) return;
      setSets(usedSets(rows, (id) => prompts.modes[id as ModeId]?.label ?? id));
    } catch {
      if (isCurrent()) setHistoryError('Could not read your history. Check your internet and try again.');
    }
  };

  useEffect(() => {
    let current = true;
    void (async () => {
      await loadHistory(() => current);
    })();
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    evidence: sets ? { ...evidenceCount({ history: sets, profile: sender }), sets: sets.length } : null,
    historyError,
    hasUsableKey: keysStatus === 'loading' || candidates.length > 0,
    phase,
    result,
    error,
    reloadHistory: () => {
      setHistoryError(null);
      return loadHistory();
    },

    async ask() {
      if (phase === 'asking' || !sets) return false;
      setError(null);
      setPhase('asking');
      try {
        const asked = await deps.suggest({
          keys: candidates,
          input: {
            tones: prompts.tones.map((tone) => ({ key: tone.key, label: tone.label, definition: tone.definition })),
            profile: sender,
            history: sets,
          },
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
        return true;
      } catch (caught) {
        const engineError = isEngineError(caught) ? caught : new EngineError('unreadable');
        setError(engineError.message);
        setPhase('idle');
        return false;
      }
    },
  };
}
