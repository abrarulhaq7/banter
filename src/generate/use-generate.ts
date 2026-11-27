import * as Clipboard from 'expo-clipboard';
import { useReducer, useRef } from 'react';

import { useAuth } from '@/auth';
import { profileGoal, replyLanguage, savesScreenshots, useKeys, useProfile } from '@/data';
import {
  EngineError,
  cleanUsername,
  generate as runEngine,
  isEngineError,
  type Adjustment,
  type ContextId,
  type Direction,
  type GenerateOptions,
  type LineFeedback,
  type GenerationResult,
  type ModeId,
  type ModelOutput,
  type PromptInput,
  type SenderProfile,
} from '@/engine';
import { marksFor, useHistory, type GenerationEntry } from '@/history';
import type { LineInsert, PersonRow, ProfileRow } from '@/lib/database.types';
import { uuid } from '@/lib/uuid';
import { toneFor, usePrompts } from '@/prompts';
import { getLatestScreenshot, pickFromGallery } from '@/screenshot';
import type { ScreenshotResult } from '@/screenshot/types';

import { keyCandidates } from './key-candidates';
import { keyProblemSaver } from './key-problems';
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
  now: () => Date;
};

const realDeps: GenerateDeps = {
  getLatestScreenshot,
  pickFromGallery,
  runEngine,
  copy: (text) => Clipboard.setStringAsync(text),
  now: () => new Date(),
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
    goal: profileGoal(profile),
  };
}

/** The texts that become saved lines: the three lines, or an analysis's suggested reply. */
function savedLineTexts(output: ModelOutput): { text: string; hook: string | null }[] {
  if (output.kind === 'lines') return output.lines.map((line) => ({ text: line.text, hook: line.hook || null }));
  if (output.kind === 'analysis' && output.suggestedReply) return [{ text: output.suggestedReply, hook: null }];
  return [];
}

type AdjustmentRequest = {
  kind: Adjustment;
  previousLines: string[];
  fix?: { line: string; reason: LineFeedback } | null;
};

/** What each "Not for me" reason is fixed with. */
const FIX_KIND: Record<LineFeedback, Adjustment> = {
  too_much: 'new_lines',
  too_tame: 'bolder',
  cringe: 'new_lines',
  not_me: 'new_lines',
  too_long: 'shorter',
  generic: 'new_lines',
};

/** What is kept of an answer besides its lines. */
function savedAnalysis(
  output: ModelOutput,
  direction: Direction | null,
  fix: LineFeedback | null,
): Record<string, unknown> | null {
  if (output.kind === 'analysis') {
    return { interest: output.interest, signals: output.signals, advice: output.advice };
  }
  if (output.kind === 'declined') return { declined: output.reason };
  // Where he asked to take the chat, and the AI's read of where it stood.
  if (direction || output.read || fix) return { direction, read: output.read ?? null, fix };
  return null;
}

export type GenerateController = SessionState & {
  /** False when the user has no key that can be tried right now. */
  hasUsableKey: boolean;
  useLatestScreenshot: () => Promise<void>;
  pickScreenshot: () => Promise<void>;
  setMode: (mode: ModeId) => void;
  /** Takes a tone's key (see `Tone.key`). */
  setTone: (tone: string) => void;
  /** Reply only: where to take the chat. */
  setDirection: (direction: Direction) => void;
  /** Why the user did not like a line, or null to take it back. Saved with the line. */
  setFeedback: (lineId: string, reason: LineFeedback | null) => void;
  /** Likes a line ("more like this"), or takes the like back. Liking clears a "not for me". */
  toggleLike: (lineId: string) => void;
  setContext: (context: ContextId) => void;
  /** Corrects who the screenshot is of. Returns a message when the username is not valid. */
  setUsername: (username: string) => string | null;
  /**
   * Says who the screenshot is of before asking, so the first set already knows her: the
   * note about her, how the user knows her, and what was sent to her before. Null goes back
   * to letting the AI read her username (only before anything was made).
   */
  choosePerson: (username: string | null) => void;
  /**
   * Asks for lines with the chosen mode and tone, or with `tone` when one is given (it
   * becomes the chosen tone). Resolves to true when a new set arrived.
   */
  generate: (tone?: string) => Promise<boolean>;
  /** New lines, shorter or bolder, from the set with this id (the newest when left out). */
  adjust: (kind: Adjustment, setId?: string) => Promise<boolean>;
  /**
   * After the user marked a line as not for them: a new set from the set it is in, made to
   * fix that (softer, bolder, shorter, less cringe…). Resolves to true when it arrived.
   */
  fixLine: (lineId: string) => Promise<boolean>;
  /** Repeats the last request, after it failed. */
  retry: () => Promise<boolean>;
  copyLine: (lineId: string, text: string) => Promise<void>;
  toggleKeep: (line: KeptLine) => void;
  dismissError: () => void;
  /** Starts over with no screenshot, keeping the mode and tone. Not while a request runs. */
  clear: () => void;
};

/** People with a note, most recently used first (the order the list is kept in). */
function notedPeople(people: PersonRow[]): NonNullable<PromptInput['notedPeople']> {
  return people
    .filter((person) => person.notes?.trim())
    .map((person) => ({ username: person.username, note: person.notes ?? '', context: person.context }));
}

export function useGenerate(overrides: Partial<GenerateDeps> = {}): GenerateController {
  const deps = { ...realDeps, ...overrides };
  const { session } = useAuth();
  const { keys, models, updateKey, status: keysStatus } = useKeys();
  const { profile } = useProfile();
  const history = useHistory();
  const prompts = usePrompts();
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  /** Where this screenshot is stored. One file serves every set made from it. */
  const screenshotPath = useRef<string | null>(null);
  /** What was asked for last, so "Try again" repeats exactly that. */
  const lastRequest = useRef<{
    adjustment: AdjustmentRequest | null;
    fromId: string | null;
    tone: string | null;
  }>({
    adjustment: null,
    fromId: null,
    tone: null,
  });

  const userId = session?.user.id ?? null;
  const candidates = keyCandidates(keys, models, deps.now().getTime());

  const loadScreenshot = async (source: () => Promise<ScreenshotResult>) => {
    if (state.phase !== 'idle') return;
    dispatch({ type: 'screenshotLoading' });
    const result = await source();
    if (result.ok) {
      screenshotPath.current = userId ? `${userId}/${uuid()}.jpg` : null;
      dispatch({ type: 'screenshotReady', screenshot: result.screenshot });
    } else {
      dispatch({ type: 'screenshotFailed', message: result.reason === 'cancelled' ? null : result.message });
    }
  };

  const run = async (
    adjustment: AdjustmentRequest | null,
    from?: ResultSet,
    chosenTone?: string,
  ): Promise<boolean> => {
    if (state.phase !== 'idle' || !state.screenshot) return false;
    const screenshot = state.screenshot;
    lastRequest.current = { adjustment, fromId: from?.id ?? null, tone: chosenTone ?? null };
    if (chosenTone) dispatch({ type: 'setTone', tone: chosenTone });

    // An adjustment keeps the mode and tone of the set it adjusts.
    const mode = from?.mode ?? state.mode;
    // Only a reply has somewhere to go. An adjustment keeps the direction of the set it adjusts.
    const direction: Direction | null =
      mode === 'reply' ? (from ? (from.direction ?? 'keep_going') : state.direction) : null;
    const heading = direction && direction !== 'keep_going' ? direction : null;

    // The tone is read now, so an edit made a moment ago in My tones is what gets sent.
    const tone =
      mode === 'analyse' ? null : toneFor(prompts.tones, from ? from.toneKey : (chosenTone ?? state.tone));

    dispatch({ type: 'generateStarted' });
    try {
      // Once the person is known, what was said to them before goes into the prompt.
      const thisScreenshot = new Set(state.sets.map((set) => set.id));
      const [memory, taste] = await Promise.all([
        state.username
          ? history.memoryFor(state.username, thisScreenshot)
          : Promise.resolve({ items: [], awaitingReplyLineId: null }),
        // What he chose and turned down before, with anyone: his taste.
        history.taste(thisScreenshot),
      ]);

      const result = await deps.runEngine({
        keys: candidates,
        image: screenshot.image,
        prompt: {
          core: prompts.core,
          mode,
          modeInstruction: prompts.modes[mode].instruction,
          tone: tone ? { label: tone.label, definition: tone.definition } : null,
          context: state.context,
          aboutHer: state.username ? (history.personByUsername(state.username)?.notes ?? null) : null,
          // Not known yet who this is: the notes on everyone, so hers counts from the first set.
          notedPeople: state.username ? [] : notedPeople(history.people),
          profile: senderProfile(profile),
          memory: memory.items,
          likedLines: taste.liked,
          dislikedLines: taste.disliked,
          // How this tone has landed with him lately: a run of the same mark adjusts it.
          toneMarks: tone ? marksFor(taste, tone.label) : [],
          direction: heading,
          language: replyLanguage(profile),
          adjustment,
        },
        // Save what was learned about a key or a model, so the next request skips it.
        onKeyProblem: keyProblemSaver(keys, updateKey, deps.now),
      });

      // A key that had been resting after a limit worked again: it is active once more.
      if (keys.find((key) => key.id === result.usedKey.id)?.status === 'limited') {
        void updateKey(result.usedKey.id, { status: 'active', last_error: null, limited_at: null });
      }

      const { output } = result;
      const at = deps.now().toISOString();
      const interactionId = uuid();
      const lines: LineInsert[] = savedLineTexts(output).map((line, index) => ({
        id: uuid(),
        interaction_id: interactionId,
        position: index + 1,
        text: line.text,
        hook: line.hook,
      }));
      const username = state.username ?? output.username;

      const entry: GenerationEntry = {
        kind: 'generation',
        username,
        context: state.context,
        interaction: {
          id: interactionId,
          parent_id: from?.id ?? null,
          adjustment: adjustment?.kind ?? null,
          mode_id: mode,
          tone_id: tone?.toneId ?? null,
          user_prompt_id: tone?.userPromptId ?? null,
          tone_label: tone?.label ?? null,
          context: state.context,
          screenshot_path: screenshotPath.current,
          screen_type: output.screenType,
          noticed: output.noticed || null,
          analysis: savedAnalysis(output, heading, adjustment?.fix?.reason ?? null),
          provider: result.usedKey.provider,
          model: result.usedKey.model,
          api_key_id: result.usedKey.id,
          api_key_label: result.usedKey.label,
          prompt_version: result.promptVersion,
          duration_ms: result.durationMs,
          created_at: at,
        },
        lines,
        // With saving turned off the file stays on the phone. The path is still recorded:
        // it is what tells the sets made from one screenshot apart from the next.
        screenshot:
          screenshotPath.current && savesScreenshots(profile)
            ? { path: screenshotPath.current, localUri: screenshot.previewUri }
            : null,
      };
      // Saving happens in the background: the lines show at once, with or without internet.
      void history.save(entry);

      // A chat screenshot can show how the last line went. Record it.
      if (output.sentLineStatus !== 'unknown' && memory.awaitingReplyLineId) {
        void history.save({
          kind: 'linePatch',
          lineId: memory.awaitingReplyLineId,
          patch: { result: output.sentLineStatus, result_at: at },
        });
      }

      // The first time the person is known, use the context remembered for them.
      const remembered = username ? history.personByUsername(username)?.context : null;
      if (remembered) dispatch({ type: 'rememberContext', context: remembered });

      dispatch({
        type: 'generateSucceeded',
        set: {
          id: interactionId,
          lineIds: lines.map((line) => line.id),
          mode,
          modeLabel: prompts.modes[mode].label,
          toneKey: tone?.key ?? null,
          toneLabel: tone?.label ?? null,
          adjustment: adjustment?.kind ?? null,
          direction: heading,
          fix: adjustment?.fix?.reason ?? null,
          output,
          usedKey: result.usedKey,
          durationMs: result.durationMs,
        },
      });
      return true;
    } catch (error) {
      // The engine only throws EngineError, but a screen must never crash on a surprise.
      const engineError = isEngineError(error) ? error : new EngineError('unreadable');
      dispatch({ type: 'generateFailed', error: { kind: engineError.kind, message: engineError.message } });
      return false;
    }
  };

  const adjust = async (kind: Adjustment, setId?: string): Promise<boolean> => {
    const from = (setId ? state.sets.find((set) => set.id === setId) : undefined) ?? state.sets[0];
    const previousLines = adjustableLines(from);
    return previousLines ? run({ kind, previousLines }, from) : false;
  };

  const setUsername = (raw: string): string | null => {
    const username = cleanUsername(raw);
    if (!username) return 'Use only letters, numbers, dots and underscores, as on Instagram.';
    if (username === state.username) return null;
    dispatch({ type: 'setUsername', username });
    // Everything already made for this screenshot moves to the corrected person.
    if (state.sets.length > 0) {
      void history.save({
        kind: 'assignPerson',
        interactionIds: state.sets.map((set) => set.id),
        username,
        context: state.context,
        previousUsername: state.username,
      });
    }
    return null;
  };

  return {
    ...state,
    // A chosen tone that has since been deleted falls back to the first one.
    tone: toneFor(prompts.tones, state.tone).key,
    hasUsableKey: keysStatus === 'loading' || candidates.length > 0,
    useLatestScreenshot: () => loadScreenshot(deps.getLatestScreenshot),
    pickScreenshot: () => loadScreenshot(deps.pickFromGallery),
    setMode: (mode) => dispatch({ type: 'setMode', mode }),
    setTone: (tone) => dispatch({ type: 'setTone', tone }),
    setDirection: (direction) => dispatch({ type: 'setDirection', direction }),

    setFeedback: (lineId, reason) => {
      dispatch({ type: 'setFeedback', lineId, reason });
      // A line is liked or not for him, never both.
      const patch = reason ? { feedback: reason, liked_at: null } : { feedback: null };
      void history.save({ kind: 'linePatch', lineId, patch });
    },

    toggleLike: (lineId) => {
      const liking = !state.liked[lineId];
      dispatch({ type: 'toggleLike', lineId });
      const patch = liking ? { liked_at: deps.now().toISOString(), feedback: null } : { liked_at: null };
      void history.save({ kind: 'linePatch', lineId, patch });
    },

    setContext: (context) => {
      dispatch({ type: 'setContext', context });
      // Remembered for the person, so it is already chosen next time.
      if (state.username && state.context !== context) {
        void history.save({ kind: 'personContext', username: state.username, context });
      }
    },

    setUsername,

    choosePerson: (username) => {
      if (state.phase !== 'idle') return;
      if (username === null) {
        // Back to "Banter reads it". Once lines are saved under someone, they stay there.
        if (state.sets.length === 0) dispatch({ type: 'setUsername', username: null });
        return;
      }
      if (setUsername(username) !== null) return;
      // Picking her brings what is known about her: how the user knows her, for a start.
      const saved = history.personByUsername(username)?.context;
      if (saved) dispatch({ type: 'rememberContext', context: saved, replace: true });
    },

    generate: (tone) => run(null, undefined, tone),
    adjust,
    retry: () => {
      const last = lastRequest.current;
      if (!last.adjustment) return run(null, undefined, last.tone ?? undefined);
      const from = state.sets.find((set) => set.id === last.fromId) ?? state.sets[0];
      return run(last.adjustment, from);
    },

    fixLine: async (lineId) => {
      const reason = state.feedback[lineId];
      const from = state.sets.find((set) => set.lineIds.includes(lineId));
      const previousLines = adjustableLines(from);
      if (!reason || !from || !previousLines) return false;
      const line = previousLines[from.lineIds.indexOf(lineId)];
      return run({ kind: FIX_KIND[reason], previousLines, fix: { line, reason } }, from);
    },

    copyLine: async (lineId, text) => {
      await deps.copy(text);
      dispatch({ type: 'copied', lineId });
      // A line copied from the Kept strip is the same saved line.
      void history.save({
        kind: 'linePatch',
        lineId: lineId.replace(/^kept:/, ''),
        patch: { copied_at: deps.now().toISOString() },
      });
    },

    toggleKeep: (line) => {
      const isKept = state.kept.some((kept) => kept.id === line.id);
      dispatch({ type: 'toggleKeep', line });
      void history.save({
        kind: 'linePatch',
        lineId: line.id,
        patch: { kept_at: isKept ? null : deps.now().toISOString() },
      });
    },

    dismissError: () => dispatch({ type: 'dismissError' }),

    clear: () => {
      if (state.phase !== 'idle') return;
      screenshotPath.current = null;
      dispatch({ type: 'clear' });
    },
  };
}
