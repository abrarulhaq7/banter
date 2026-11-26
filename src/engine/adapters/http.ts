import type { ProviderId } from '@/lib/database.types';

import { EngineError } from '../errors';
import type { AnswerSchema } from '../schema';
import type { ImageInput } from '../types';

/** What every adapter receives. The same for all three providers. */
export type AdapterRequest = {
  key: string;
  model: string;
  system: string;
  user: string;
  /** Left out for a request that is text only (tone suggestions). */
  image?: ImageInput;
  schema: AnswerSchema;
  /** Tests pass a fake. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/** Sends the prompt, with the screenshot when there is one, and returns the model's answer as text. */
export type Adapter = (request: AdapterRequest) => Promise<string>;

export const DEFAULT_TIMEOUT_MS = 90000;

type Posted = { status: number; body: unknown };

/** POSTs JSON and returns the status and parsed body. Network trouble becomes 'no_internet'. */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  { fetch: fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: Pick<AdapterRequest, 'fetch' | 'timeoutMs'>,
): Promise<Posted> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      // Not JSON. The status decides what happens.
    }
    return { status: response.status, body: parsed };
  } catch {
    throw new EngineError('no_internet', {
      message: controller.signal.aborted
        ? 'The AI took too long to answer. Try again.'
        : undefined,
    });
  } finally {
    clearTimeout(timer);
  }
}

type ProviderErrorBody = {
  error?: { message?: unknown; type?: unknown; status?: unknown; code?: unknown; details?: unknown };
};

/** Gemini's generation endpoint wraps its error in a list: `[{ "error": ... }]`. */
function errorOf(body: unknown): ProviderErrorBody['error'] {
  const first: unknown = Array.isArray(body) ? body[0] : body;
  return (first as ProviderErrorBody | null)?.error;
}

/** The provider's own error text, for the developer only. Providers do not echo full keys. */
function errorDetail(body: unknown): string {
  const error = errorOf(body);
  const parts = [error?.type, error?.status, error?.code, error?.message].filter(
    (part): part is string => typeof part === 'string',
  );
  return parts.join(' | ').slice(0, 500);
}

function isGeminiBadKey(body: unknown): boolean {
  const error = errorOf(body);
  const details = Array.isArray(error?.details) ? error.details : [];
  return (
    details.some((detail) => (detail as { reason?: unknown })?.reason === 'API_KEY_INVALID') ||
    (typeof error?.message === 'string' && /api key not valid/i.test(error.message))
  );
}

function isOutOfCredit(body: unknown): boolean {
  const error = errorOf(body);
  const text = [error?.type, error?.code, error?.message].filter((part) => typeof part === 'string').join(' ');
  return /insufficient_quota|credit_balance|no credits? remaining|billing/i.test(text);
}

/** Throws the right EngineError for a response that is not a success. */
export function throwForStatus(provider: ProviderId, { status, body }: Posted): void {
  if (status >= 200 && status < 300) return;
  const detail = `${provider} HTTP ${status}: ${errorDetail(body)}`;

  if (status === 401 || status === 403 || (provider === 'gemini' && status === 400 && isGeminiBadKey(body))) {
    throw new EngineError('wrong_key', { detail });
  }
  // 402 always means no credit. OpenAI reports no credit as 429 with its own code.
  if (status === 402 || (status === 429 && isOutOfCredit(body))) {
    throw new EngineError('no_credit', { detail });
  }
  // Any other 429: a rate limit or a spending cap.
  if (status === 429) throw new EngineError('limit', { detail });
  if (status >= 500) throw new EngineError('provider_down', { detail });
  throw new EngineError('bad_request', { detail });
}
