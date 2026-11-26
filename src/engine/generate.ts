import { ADAPTERS, type Adapter } from './adapters';
import { EngineError, isEngineError } from './errors';
import { buildPrompt } from './prompt';
import { parseModelOutput, schemaFor } from './schema';
import type { GenerationResult, ImageInput, KeyCandidate, ModelOutput, PromptInput } from './types';

import type { ProviderId } from '@/lib/database.types';

export type KeyProblem = {
  keyId: string;
  /** What the key's status should become. */
  status: 'limited' | 'invalid';
  message: string;
};

export type GenerateOptions = {
  /** The user's usable keys, in the order to try them. */
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

/**
 * Screenshot in, checked answer out.
 *
 * Keys are tried in order. A key that hits its limit or is rejected is reported and the
 * next one is tried. An answer that cannot be read is asked for once more, and a provider
 * that is briefly busy is asked again twice. A refusal or a lost connection ends the attempt: another key would
 * not change either.
 */
export async function generate(options: GenerateOptions): Promise<GenerationResult> {
  const { keys, prompt, image, onKeyProblem, now = Date.now } = options;
  const { busyRetryDelaysMs = [1500, 4000], sleep = defaultSleep } = options;
  if (keys.length === 0) throw new EngineError('no_keys');

  const started = now();
  const built = buildPrompt(prompt);
  const schema = schemaFor(prompt.mode);
  let lastError: EngineError | null = null;

  for (const key of keys) {
    const adapter = options.adapters?.[key.provider] ?? ADAPTERS[key.provider];
    const ask = async (): Promise<ModelOutput> => {
      const text = await adapter({
        key: key.key,
        model: key.model,
        system: built.system,
        user: built.user,
        image,
        schema,
        fetch: options.fetch,
        timeoutMs: options.timeoutMs,
      });
      return parseModelOutput(prompt.mode, text);
    };

    try {
      let output: ModelOutput;
      try {
        output = await ask();
      } catch (error) {
        if (!isEngineError(error)) throw error;
        if (error.kind === 'unreadable') {
          // One more try for an answer that came back in the wrong shape.
          output = await ask();
        } else if (error.kind === 'provider_down') {
          // Providers are often busy for a few seconds only. Wait and ask again.
          output = await askWhenLessBusy(ask, busyRetryDelaysMs, sleep, error);
        } else {
          throw error;
        }
      }
      return {
        output,
        usedKey: { id: key.id, label: key.label, provider: key.provider, model: key.model },
        promptVersion: prompt.core.version,
        durationMs: now() - started,
      };
    } catch (error) {
      const engineError = isEngineError(error)
        ? error
        : new EngineError('unreadable', { detail: error instanceof Error ? error.message : String(error) });
      lastError = engineError;

      if (engineError.kind === 'limit' || engineError.kind === 'no_credit') {
        await onKeyProblem?.({ keyId: key.id, status: 'limited', message: engineError.message });
        continue;
      }
      if (engineError.kind === 'wrong_key') {
        await onKeyProblem?.({ keyId: key.id, status: 'invalid', message: engineError.message });
        continue;
      }
      // A different provider may be up, or may accept the request.
      if (engineError.kind === 'provider_down' || engineError.kind === 'bad_request') continue;
      // Refused, unreadable twice, or no internet: stop here.
      throw engineError;
    }
  }

  if (lastError?.kind === 'limit' || lastError?.kind === 'no_credit') {
    // With one key, say exactly what is wrong with it. With several, they may differ.
    if (keys.length === 1) {
      throw lastError.kind === 'limit'
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
