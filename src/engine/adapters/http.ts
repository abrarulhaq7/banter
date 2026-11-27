import type { ProviderId } from '@/lib/database.types';

import { EngineError, type LimitHint } from '../errors';
import type { AnswerSchema } from '../schema';
import type { ImageInput } from '../types';

/** What every adapter receives. The same for every provider. */
export type AdapterRequest = {
  key: string;
  model: string;
  system: string;
  user: string;
  /** Left out for a request that is text only (tone suggestions). */
  image?: ImageInput;
  /** Several images, sent in this order (examples to learn a tone from). Wins over `image`. */
  images?: ImageInput[];
  schema: AnswerSchema;
  /** Tests pass a fake. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/** Sends the prompt, with the screenshot when there is one, and returns the model's answer as text. */
export type Adapter = (request: AdapterRequest) => Promise<string>;

/** The images a request carries, in order: `images`, else the one `image`, else none. */
export function requestImages(request: Pick<AdapterRequest, 'image' | 'images'>): ImageInput[] {
  if (request.images && request.images.length > 0) return request.images;
  return request.image ? [request.image] : [];
}

export const DEFAULT_TIMEOUT_MS = 90000;

export type Posted = {
  status: number;
  body: unknown;
  /** The Retry-After header, when there is one. */
  retryAfter?: string | null;
};

/**
 * POSTs JSON and returns the status and parsed body. Network trouble becomes 'no_internet';
 * a model that takes too long becomes 'timeout'.
 */
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
    return { status: response.status, body: parsed, retryAfter: response.headers?.get?.('retry-after') ?? null };
  } catch {
    throw new EngineError(controller.signal.aborted ? 'timeout' : 'no_internet', {
      detail: controller.signal.aborted ? `no answer within ${timeoutMs} ms` : undefined,
    });
  } finally {
    clearTimeout(timer);
  }
}

type ProviderErrorBody = {
  error?: {
    message?: unknown;
    type?: unknown;
    status?: unknown;
    code?: unknown;
    details?: unknown;
    metadata?: unknown;
  };
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

/**
 * A 429 that means the account has no credit (OpenAI sends no credit as a 429). Read from
 * the error's type and code, and only a clear sentence in the message: Groq's ordinary
 * rate-limit message links to its billing page, and that is not "no credit".
 */
function isOutOfCredit(body: unknown): boolean {
  const error = errorOf(body);
  const codes = [error?.type, error?.code].filter((part) => typeof part === 'string').join(' ');
  if (/rate_limit/i.test(codes)) return false;
  const message = typeof error?.message === 'string' ? error.message : '';
  return /insufficient_quota|credit_balance|billing_error/i.test(codes) || /no credits? remaining/i.test(message);
}

/** OpenRouter's own check flagged the request. That is a refusal, not a wrong key. */
function isModerationBlock(body: unknown): boolean {
  const metadata = errorOf(body)?.metadata as { flagged_input?: unknown; reasons?: unknown } | undefined;
  return metadata?.flagged_input !== undefined || metadata?.reasons !== undefined;
}

/**
 * OpenRouter: the host behind a free model is out of capacity for everyone
 * ("temporarily rate-limited upstream", limit_source "upstream_provider_shared_pool").
 */
function isBusyUpstream(body: unknown): boolean {
  const metadata = errorOf(body)?.metadata as { limit_source?: unknown; raw?: unknown } | undefined;
  return (
    metadata?.limit_source === 'upstream_provider_shared_pool' ||
    (typeof metadata?.raw === 'string' && /rate-limited upstream/i.test(metadata.raw))
  );
}

/** A duration as providers write it: "37s", "37.5s", "2m10.5s", "1h", "250ms". */
export function parseDuration(text: string): number | null {
  const parts = [...text.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)];
  if (parts.length === 0) return null;
  const unit = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 } as const;
  return Math.round(parts.reduce((total, [, amount, name]) => total + Number(amount) * unit[name as keyof typeof unit], 0));
}

/**
 * What a 429 says about when to try again. Each provider says it its own way:
 * a Retry-After header, Gemini's RetryInfo and QuotaFailure details, or a sentence
 * ("Please try again in 1m26s", "requests per day (RPD)", "free-models-per-day").
 */
export function limitHint({ body, retryAfter }: Posted): LimitHint {
  const error = errorOf(body);
  const text = JSON.stringify(error ?? body ?? '');
  const hint: LimitHint = {};

  if (/per[ _-]?day|daily|\bRPD\b|\bTPD\b/i.test(text)) hint.daily = true;

  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    hint.retryAfterMs = seconds * 1000;
    return hint;
  }
  const details = Array.isArray(error?.details) ? error.details : [];
  const delay = details
    .map((detail) => (detail as { retryDelay?: unknown })?.retryDelay)
    .find((value): value is string => typeof value === 'string');
  const said = delay ?? text.match(/(?:retry|try again) in ((?:\d+(?:\.\d+)?(?:ms|h|m|s))+)/i)?.[1];
  const ms = said ? parseDuration(said) : null;
  if (ms !== null) hint.retryAfterMs = ms;
  // A per-minute limit with no time given ("output tokens per minute (OTPM)") clears within a minute.
  else if (!hint.daily && /per[ _-]?minute|\b[IO]?[RT]PM\b/i.test(text)) hint.retryAfterMs = 60_000;
  return hint;
}

/** Throws the right EngineError for a response that is not a success. */
export function throwForStatus(provider: ProviderId, posted: Posted): void {
  const { status, body } = posted;
  if (status >= 200 && status < 300) return;
  const detail = `${provider} HTTP ${status}: ${errorDetail(body)}`;

  if (provider === 'openrouter' && status === 403 && isModerationBlock(body)) {
    throw new EngineError('refused', { detail });
  }
  if (status === 401 || status === 403 || (provider === 'gemini' && status === 400 && isGeminiBadKey(body))) {
    throw new EngineError('wrong_key', { detail });
  }
  // 402 always means no credit. OpenAI reports no credit as 429 with its own code.
  if (status === 402 || (status === 429 && isOutOfCredit(body))) {
    throw new EngineError('no_credit', { detail });
  }
  // OpenRouter's free models share hosts with everyone. A busy host is not the key's limit.
  if (provider === 'openrouter' && status === 429 && isBusyUpstream(body)) {
    throw new EngineError('limit', {
      detail,
      message: "OpenRouter's free model is busy right now. Try again in a minute.",
      limit: { retryAfterMs: 60_000 },
    });
  }
  // Any other 429: a rate limit or a spending cap.
  if (status === 429) throw new EngineError('limit', { detail, limit: limitHint(posted) });
  // 408: OpenRouter's model took too long. 498: Groq's flex capacity is full.
  if (status >= 500 || status === 408 || status === 498) throw new EngineError('provider_down', { detail });
  if (provider === 'openrouter' && status === 404 && /data policy|privacy/i.test(detail)) {
    throw new EngineError('bad_request', {
      detail,
      message: "OpenRouter's privacy settings let none of its free models answer. Allow them at openrouter.ai/settings/privacy.",
    });
  }
  throw new EngineError('bad_request', { detail });
}
