import type { ProviderId } from '@/lib/database.types';

import { PROVIDERS } from './providers';

/**
 * Checks an API key by asking the provider for its list of models.
 *
 * That request is free on all three providers and uses none of the key's generation
 * allowance. The phone calls the provider directly; the key is sent nowhere else.
 *
 * The providers' own SDKs are not used: they do not support React Native, and one small
 * request per provider does not need them.
 */

export type KeyCheckFailure =
  /** The provider says the key is wrong, revoked or not allowed. */
  | 'invalid'
  /** The key is real but is being rate limited or has no credit. */
  | 'limited'
  | 'no_internet'
  /** The provider is having trouble (5xx). */
  | 'provider_down'
  /** An answer we do not understand. */
  | 'unexpected';

export type KeyCheckResult =
  | { ok: true; modelIds: string[] }
  | { ok: false; reason: KeyCheckFailure; message: string };

type Options = {
  /** Tests pass a fake. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

type Request = { url: string; headers: Record<string, string> };

const REQUESTS: Record<ProviderId, (key: string) => Request> = {
  claude: (key) => ({
    url: 'https://api.anthropic.com/v1/models?limit=1000',
    headers: { 'x-api-key': key, 'anthropic-version': '2026-10-21' },
  }),
  openai: (key) => ({
    url: 'https://api.openai.com/v1/models',
    headers: { Authorization: `Bearer ${key}` },
  }),
  gemini: (key) => ({
    url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
    headers: { 'x-goog-api-key': key },
  }),
};

/** Pulls the model ids out of each provider's own list format. Null if it is not one. */
function readModelIds(provider: ProviderId, body: unknown): string[] | null {
  if (typeof body !== 'object' || body === null) return null;

  if (provider === 'gemini') {
    const models = (body as { models?: unknown }).models;
    if (!Array.isArray(models)) return null;
    // Gemini names look like "models/gemini-3.5-flash-lite".
    return models
      .map((model) => (model as { name?: unknown })?.name)
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.replace(/^models\//, ''));
  }

  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  return data
    .map((model) => (model as { id?: unknown })?.id)
    .filter((id): id is string => typeof id === 'string');
}

/** Gemini reports a bad key as 400 with this reason, not as 401. */
function isGeminiBadKey(body: unknown): boolean {
  // Some Gemini endpoints wrap the error in a list: `[{ "error": ... }]`.
  const first: unknown = Array.isArray(body) ? body[0] : body;
  const error = (first as { error?: { status?: unknown; details?: unknown; message?: unknown } } | null)?.error;
  if (!error) return false;
  const details = Array.isArray(error.details) ? error.details : [];
  return (
    details.some((detail) => (detail as { reason?: unknown })?.reason === 'API_KEY_INVALID') ||
    (typeof error.message === 'string' && /api key not valid/i.test(error.message))
  );
}

export async function checkKey(
  provider: ProviderId,
  rawKey: string,
  { fetch: fetchImpl = fetch, timeoutMs = 15000 }: Options = {},
): Promise<KeyCheckResult> {
  const name = PROVIDERS[provider].label;
  const key = rawKey.trim();
  const request = REQUESTS[provider](key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: 'GET',
      headers: request.headers,
      signal: controller.signal,
    });
  } catch {
    return {
      ok: false,
      reason: 'no_internet',
      message: controller.signal.aborted
        ? `${name} took too long to answer. Check your internet and try again.`
        : `Could not reach ${name}. Check your internet and try again.`,
    };
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON. Decided below from the status alone.
  }

  const { status } = response;

  if (status === 401 || status === 403 || (provider === 'gemini' && status === 400 && isGeminiBadKey(body))) {
    return {
      ok: false,
      reason: 'invalid',
      message: `${name} rejected this key. Check that you copied all of it and that it belongs to ${name}.`,
    };
  }
  if (status === 402) {
    return {
      ok: false,
      reason: 'limited',
      message: `This ${name} key has no credit. Add credit at ${name}, then try again.`,
    };
  }
  if (status === 429) {
    return {
      ok: false,
      reason: 'limited',
      message: `This ${name} key is at its limit right now. Wait a minute and try again.`,
    };
  }
  if (status >= 500) {
    return {
      ok: false,
      reason: 'provider_down',
      message: `${name} is having trouble right now. Try again in a moment.`,
    };
  }

  const modelIds = response.ok ? readModelIds(provider, body) : null;
  if (!modelIds) {
    return {
      ok: false,
      reason: 'unexpected',
      message: `${name} gave an answer Banter did not understand. Try again.`,
    };
  }
  return { ok: true, modelIds };
}
