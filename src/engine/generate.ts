import { ADAPTERS, type Adapter } from './adapters';
import { EngineError, isEngineError, type LimitHint } from './errors';
import { buildPrompt, linesWanted } from './prompt';
import { parseModelOutput, schemaFor, type AnswerSchema } from './schema';
import type { GenerationResult, ImageInput, KeyCandidate, PromptInput } from './types';

import type { ProviderId } from '@/lib/database.types';

export type KeyProblem = {
  keyId: string;
  /** The model that was asked. */
  model: string;
  /**
   * 'model': only this model hit its limit; the key's other models may still answer.
   * 'key': the whole key is affected: it was rejected, or its account has no credit.
   */
  scope: 'model' | 'key';
  /** What the key's status should become, for a 'key' problem. */
  status: 'limited' | 'invalid';
  message: string;
  /** For a limit: what the provider said about when to try again. */
  limit?: LimitHint;
};

export type GenerateOptions = {
  /**
   * What to try, in order: each of the user's keys with a model it can use, best model
   * first. A key appears once per model.
   */
  keys: KeyCandidate[];
  prompt: PromptInput;
  image: ImageInput;
  /** Called when a key hits its limit or is rejected, so its status can be saved. */
  onKeyProblem?: (problem: KeyProblem) => void | Promise<void>;
  /** Tests pass fakes. */
  adapters?: Partial<Record<ProviderId, Adapter>>;
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  /** How long to wait before each new try with a busy provider. One try per entry. */
  busyRetryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/**
 * How long a model may take when another one is waiting in line. The last in line gets
 * the adapters' full 90 seconds. Lines usually come back in 2 to 30 seconds.
 */
export const TIMEOUT_WITH_NEXT_MS = 60_000;
/** A model that took too long is left alone this long, so only one request waits for it. */
export const SLOW_MODEL_REST_MS = 10 * 60_000;

async function askWhenLessBusy<T>(
  ask: () => Promise<T>,
  delaysMs: number[],
  sleep: (ms: number) => Promise<void>,
  firstError: EngineError,
): Promise<T> {
  let lastError = firstError;
  for (const delay of delaysMs) {
    await sleep(delay);
    try {
      return await ask();
    } catch (error) {
      if (!isEngineError(error) || error.kind !== 'provider_down') throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/** The options every request to a provider shares, whatever is being asked. */
export type AskOptions = Pick<
  GenerateOptions,
  'keys' | 'onKeyProblem' | 'adapters' | 'fetch' | 'timeoutMs' | 'now' | 'busyRetryDelaysMs' | 'sleep'
>;

export type Asked<T> = {
  output: T;
  usedKey: GenerationResult['usedKey'];
  durationMs: number;
};

/**
 * Sends one request and returns the checked answer.
 *
 * The choices are tried in order, best model first. A model that hits its limit is
 * reported and the next choice is tried at once. A key that is rejected or out of credit
 * is reported and none of its models is tried again. A model that is busy is passed over
 * for the next choice; only if nothing else answers is it waited for and asked again. A
 * model that took too long is passed over and rested for 10 minutes. When another model is
 * waiting in line, a model gets 60 seconds instead of 90.
 * An answer that cannot be read is asked for once more. A refusal or a lost connection
 * ends the attempt: another model would not change either.
 */
export async function askWithKeys<T>(
  options: AskOptions,
  request: { system: string; user: string; image?: ImageInput; images?: ImageInput[]; schema: AnswerSchema },
  parse: (text: string) => T,
): Promise<Asked<T>> {
  const { keys, onKeyProblem, now = Date.now } = options;
  const { busyRetryDelaysMs = [1500, 4000], sleep = defaultSleep } = options;
  if (keys.length === 0) throw new EngineError('no_keys');

  const started = now();
  let lastError: EngineError | null = null;
  /** Keys that were rejected or have no credit: their other models are skipped. */
  const skipped = new Set<string>();
  /** The first choice that was busy, to wait for if nothing else answers. */
  let firstBusy: { key: KeyCandidate; ask: () => Promise<T>; error: EngineError } | null = null;

  const answered = (key: KeyCandidate, output: T): Asked<T> => ({
    output,
    usedKey: { id: key.id, label: key.label, provider: key.provider, model: key.model },
    durationMs: now() - started,
  });

  for (const [index, key] of keys.entries()) {
    if (skipped.has(key.id)) continue;
    const adapter = options.adapters?.[key.provider] ?? ADAPTERS[key.provider];
    const another = keys.slice(index + 1).some((next) => !skipped.has(next.id));
    const timeoutMs = options.timeoutMs ?? (another ? TIMEOUT_WITH_NEXT_MS : undefined);
    const ask = async (): Promise<T> => {
      const text = await adapter({
        key: key.key,
        model: key.model,
        ...request,
        fetch: options.fetch,
        timeoutMs,
      });
      return parse(text);
    };

    try {
      let output: T;
      try {
        output = await ask();
      } catch (error) {
        // One more try for an answer that came back in the wrong shape.
        if (isEngineError(error) && error.kind === 'unreadable') output = await ask();
        else throw error;
      }
      return answered(key, output);
    } catch (error) {
      const engineError = isEngineError(error)
        ? error
        : new EngineError('unreadable', { detail: error instanceof Error ? error.message : String(error) });
      lastError = engineError;
      const problem = { keyId: key.id, model: key.model, message: engineError.message };

      if (engineError.kind === 'limit') {
        await onKeyProblem?.({ ...problem, scope: 'model', status: 'limited', limit: engineError.limit });
        continue;
      }
      if (engineError.kind === 'no_credit' || engineError.kind === 'wrong_key') {
        skipped.add(key.id);
        const status = engineError.kind === 'wrong_key' ? 'invalid' : 'limited';
        await onKeyProblem?.({ ...problem, scope: 'key', status });
        continue;
      }
      if (engineError.kind === 'provider_down') {
        // Providers are often busy for a few seconds only. Try the next choice now, and
        // come back to this one if nothing else answers.
        firstBusy ??= { key, ask, error: engineError };
        continue;
      }
      if (engineError.kind === 'timeout') {
        // A model that hangs is usually overloaded. Rest it, so the next request does not
        // wait for it too, and do not wait for it again now: that could take minutes.
        await onKeyProblem?.({
          ...problem,
          scope: 'model',
          status: 'limited',
          limit: { retryAfterMs: SLOW_MODEL_REST_MS },
        });
        continue;
      }
      // Another model may accept the request.
      if (engineError.kind === 'bad_request') continue;
      // Refused, unreadable twice, or no internet: stop here.
      throw engineError;
    }
  }

  if (firstBusy) {
    const { key, ask, error } = firstBusy;
    return answered(key, await askWhenLessBusy(ask, busyRetryDelaysMs, sleep, error));
  }

  if (lastError?.kind === 'limit' || lastError?.kind === 'no_credit') {
    // With one key, say exactly what is wrong with it. With several, they may differ.
    if (new Set(keys.map((key) => key.id)).size === 1) {
      // Keep a provider's own explanation ("the free model is busy"); word the plain one.
      const plain = lastError.message === new EngineError('limit').message;
      throw lastError.kind === 'limit' && plain
        ? new EngineError('limit', { message: 'Your key has reached its limit.', detail: lastError.detail })
        : lastError;
    }
    throw new EngineError('limit', {
      message: 'None of your keys can be used right now. They are at their limit or out of credit.',
      detail: lastError.detail,
    });
  }
  throw lastError ?? new EngineError('no_keys');
}

/** Screenshot in, checked answer out. */
export async function generate(options: GenerateOptions): Promise<GenerationResult> {
  const { prompt, image } = options;
  const built = buildPrompt(prompt);
  // The read of where a chat stands is asked for only with "Where to take it". Some models
  // fill it in anyway; it is dropped then, so no read shows that nobody asked for.
  const asksForRead = prompt.mode === 'reply' && Boolean(prompt.direction) && prompt.direction !== 'keep_going';
  const asked = await askWithKeys(
    options,
    { system: built.system, user: built.user, image, schema: schemaFor(prompt.mode) },
    (text) => {
      const output = parseModelOutput(prompt.mode, text, linesWanted(prompt));
      if (output.kind !== 'lines' || asksForRead || !output.read) return output;
      const withoutRead = { ...output };
      delete withoutRead.read;
      return withoutRead;
    },
  );
  return { ...asked, promptVersion: prompt.core.version, request: built.user };
}
