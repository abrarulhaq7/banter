import { ADAPTERS, EngineError, schemaFor, type AdapterRequest } from '@/engine';
import { limitHint, parseDuration } from '@/engine/adapters/http';
import type { ProviderId } from '@/lib/database.types';

type Call = { url: string; headers: Record<string, string>; body: Record<string, any> };

function fakeFetch(status: number, responseBody: unknown, responseHeaders: Record<string, string> = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string),
    });
    return {
      status,
      headers: { get: (name: string) => responseHeaders[name.toLowerCase()] ?? null },
      json: async () => {
        if (typeof responseBody === 'string') throw new SyntaxError('not json');
        return responseBody;
      },
    };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const request = (overrides: Partial<AdapterRequest> = {}): AdapterRequest => ({
  key: 'SECRET-KEY',
  model: 'the-model',
  system: 'SYSTEM RULES',
  user: 'USER TASK',
  image: { base64: 'QUJD', mediaType: 'image/jpeg' },
  schema: schemaFor('story_reply'),
  ...overrides,
});

const ANSWER = '{"username":"a","screen_type":"story","noticed":"n","refusal":"","lines":[]}';

/** A successful answer in each provider's own format. */
const OK: Record<ProviderId, unknown> = {
  claude: { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: ANSWER }] },
  openai: {
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [{ type: 'output_text', text: ANSWER }] },
    ],
  },
  gemini: { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: ANSWER }] }] },
  groq: { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: ANSWER } }] },
  openrouter: { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: ANSWER, refusal: null } }] },
};

const ALL: ProviderId[] = ['claude', 'openai', 'gemini', 'groq', 'openrouter'];

async function kindOf(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    return 'no error';
  } catch (error) {
    return error instanceof EngineError ? error.kind : `other: ${String(error)}`;
  }
}

describe('adapters: what is sent', () => {
  it('Claude: Messages API, key in a header, image and structure in the body', async () => {
    const { fetchImpl, calls } = fakeFetch(200, OK.claude);

    expect(await ADAPTERS.claude(request({ fetch: fetchImpl }))).toBe(ANSWER);

    const [call] = calls;
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.headers).toMatchObject({ 'x-api-key': 'SECRET-KEY', 'anthropic-version': '2026-10-21' });
    expect(call.body.model).toBe('the-model');
    expect(call.body.system).toBe('SYSTEM RULES');
    expect(call.body.messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } },
      { type: 'text', text: 'USER TASK' },
    ]);
    expect(call.body.output_config.format).toEqual({
      type: 'json_schema',
      schema: schemaFor('story_reply').schema,
    });
    // This API version rejects sampling settings.
    expect(call.body).not.toHaveProperty('temperature');
  });

  it('OpenAI: Responses API, not stored, strict structure', async () => {
    const { fetchImpl, calls } = fakeFetch(200, OK.openai);

    expect(await ADAPTERS.openai(request({ fetch: fetchImpl }))).toBe(ANSWER);

    const [call] = calls;
    expect(call.url).toBe('https://api.openai.com/v1/responses');
    expect(call.headers).toMatchObject({ Authorization: 'Bearer SECRET-KEY' });
    expect(call.body.store).toBe(false);
    expect(call.body.input[0]).toEqual({ role: 'system', content: 'SYSTEM RULES' });
    expect(call.body.input[1].content).toEqual([
      { type: 'input_text', text: 'USER TASK' },
      { type: 'input_image', image_url: 'data:image/jpeg;base64,QUJD' },
    ]);
    expect(call.body.text.format).toMatchObject({ type: 'json_schema', name: 'banter_lines', strict: true });
  });

  it('Gemini: Interactions API, not stored, JSON structure', async () => {
    const { fetchImpl, calls } = fakeFetch(200, OK.gemini);

    expect(await ADAPTERS.gemini(request({ fetch: fetchImpl }))).toBe(ANSWER);

    const [call] = calls;
    expect(call.url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(call.headers).toMatchObject({ 'x-goog-api-key': 'SECRET-KEY', 'Api-Revision': '2026-05-20' });
    expect(call.body.store).toBe(false);
    expect(call.body.system_instruction).toBe('SYSTEM RULES');
    expect(call.body.input).toEqual([
      { type: 'text', text: 'USER TASK' },
      { type: 'image', data: 'QUJD', mime_type: 'image/jpeg' },
    ]);
    expect(call.body.response_format).toMatchObject({ type: 'text', mime_type: 'application/json' });
  });

  it.each([
    ['groq', 'https://api.groq.com/openai/v1/chat/completions'],
    ['openrouter', 'https://openrouter.ai/api/v1/chat/completions'],
  ] as const)('%s: Chat Completions, key in a header, image and strict structure in the body', async (provider, url) => {
    const { fetchImpl, calls } = fakeFetch(200, OK[provider]);

    expect(await ADAPTERS[provider](request({ fetch: fetchImpl }))).toBe(ANSWER);

    const [call] = calls;
    expect(call.url).toBe(url);
    expect(call.headers).toMatchObject({ Authorization: 'Bearer SECRET-KEY' });
    expect(call.body.model).toBe('the-model');
    expect(call.body.messages).toEqual([
      { role: 'system', content: 'SYSTEM RULES' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'USER TASK' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } },
        ],
      },
    ]);
    expect(call.body.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'banter_lines', strict: true, schema: schemaFor('story_reply').schema },
    });
    // These providers reject fields they do not know.
    expect(call.body).not.toHaveProperty('store');
    expect(call.body).not.toHaveProperty('temperature');
  });

  it('OpenRouter: only to hosts that keep to the schema', async () => {
    const { fetchImpl, calls } = fakeFetch(200, OK.openrouter);
    await ADAPTERS.openrouter(request({ fetch: fetchImpl }));
    expect(calls[0].body.provider).toEqual({ require_parameters: true });
  });

  it('Groq: keeps a Qwen model\'s thinking out of the answer, and sends nothing extra to other models', async () => {
    const qwen = fakeFetch(200, OK.groq);
    await ADAPTERS.groq(request({ fetch: qwen.fetchImpl, model: 'qwen/qwen3.8-27b' }));
    expect(qwen.calls[0].body.reasoning_format).toBe('hidden');

    const other = fakeFetch(200, OK.groq);
    await ADAPTERS.groq(request({ fetch: other.fetchImpl, model: 'openai/gpt-oss-120b' }));
    expect(other.calls[0].body).not.toHaveProperty('reasoning_format');
  });

  it('Chat Completions: a text-only request sends no image', async () => {
    const { fetchImpl, calls } = fakeFetch(200, OK.groq);
    await ADAPTERS.groq(request({ fetch: fetchImpl, image: undefined }));
    expect(calls[0].body.messages[1].content).toEqual([{ type: 'text', text: 'USER TASK' }]);
  });

  it.each(ALL)('%s: the key is never in the address or the body', async (provider) => {
    const { fetchImpl, calls } = fakeFetch(200, OK[provider]);
    await ADAPTERS[provider](request({ fetch: fetchImpl }));

    expect(calls[0].url).not.toContain('SECRET-KEY');
    expect(JSON.stringify(calls[0].body)).not.toContain('SECRET-KEY');
  });
});

describe('adapters: several images', () => {
  const images = [
    { base64: 'AAA', mediaType: 'image/jpeg' as const },
    { base64: 'BBB', mediaType: 'image/jpeg' as const },
  ];
  /** The image data each provider was sent, in order, found in its own format. */
  const sentImages = (body: Record<string, any>): string[] =>
    JSON.stringify(body).match(/AAA|BBB|QUJD/g) ?? [];

  it.each(ALL)('%s sends every image, in order, in place of the one image', async (provider) => {
    const { fetchImpl, calls } = fakeFetch(200, OK[provider]);

    await ADAPTERS[provider](request({ fetch: fetchImpl, images }));

    expect(sentImages(calls[0].body)).toEqual(['AAA', 'BBB']);
  });
});

describe('adapters: problems are mapped to the same plain cases', () => {
  const providers = ALL;

  it.each(providers)('%s: wrong key', async (provider) => {
    const { fetchImpl } = fakeFetch(401, { error: { message: 'bad key' } });
    expect(await kindOf(ADAPTERS[provider](request({ fetch: fetchImpl })))).toBe('wrong_key');
  });

  it('Gemini wraps the wrong-key error in a list on this endpoint (its exact answer on 2026-11-25)', async () => {
    const { fetchImpl } = fakeFetch(400, [
      {
        error: {
          code: 400,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'INVALID_ARGUMENT',
          details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }],
        },
      },
    ]);

    const run = ADAPTERS.gemini(request({ fetch: fetchImpl }));

    await expect(run).rejects.toMatchObject({
      kind: 'wrong_key',
      detail: expect.stringContaining('API key not valid'),
    });
  });

  it('Gemini reports a wrong key as 400, which is still "wrong key"', async () => {
    const { fetchImpl } = fakeFetch(400, {
      error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] },
    });
    expect(await kindOf(ADAPTERS.gemini(request({ fetch: fetchImpl })))).toBe('wrong_key');
  });

  it.each(providers)('%s: limit reached (429)', async (provider) => {
    const { fetchImpl } = fakeFetch(429, { error: { message: 'slow down' } });
    expect(await kindOf(ADAPTERS[provider](request({ fetch: fetchImpl })))).toBe('limit');
  });

  it('Claude: no credit (402)', async () => {
    const { fetchImpl } = fakeFetch(402, { type: 'error', error: { type: 'billing_error' } });
    expect(await kindOf(ADAPTERS.claude(request({ fetch: fetchImpl })))).toBe('no_credit');
  });

  it('OpenAI: no credit comes as 429 (its exact answer on 2026-11-25)', async () => {
    const { fetchImpl } = fakeFetch(429, {
      error: {
        message:
          'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.',
        type: 'insufficient_quota',
        code: 'credit_balance_exhausted',
      },
    });
    expect(await kindOf(ADAPTERS.openai(request({ fetch: fetchImpl })))).toBe('no_credit');
  });

  it('an ordinary rate limit is not mistaken for no credit', async () => {
    const { fetchImpl } = fakeFetch(429, {
      error: { message: 'Rate limit reached for requests', type: 'requests', code: 'rate_limit_exceeded' },
    });
    expect(await kindOf(ADAPTERS.openai(request({ fetch: fetchImpl })))).toBe('limit');
  });

  it.each(providers)('%s: provider trouble (5xx)', async (provider) => {
    const { fetchImpl } = fakeFetch(503, 'gateway page');
    expect(await kindOf(ADAPTERS[provider](request({ fetch: fetchImpl })))).toBe('provider_down');
  });

  it.each(providers)('%s: a request the provider does not accept, such as an unknown model', async (provider) => {
    const { fetchImpl } = fakeFetch(404, { error: { message: 'model not found' } });
    expect(await kindOf(ADAPTERS[provider](request({ fetch: fetchImpl })))).toBe('bad_request');
  });

  it.each(providers)('%s: no internet', async (provider) => {
    const fetchImpl = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    expect(await kindOf(ADAPTERS[provider](request({ fetch: fetchImpl })))).toBe('no_internet');
  });

  it('gives up when the provider takes too long', async () => {
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;

    const run = ADAPTERS.openai(request({ fetch: fetchImpl, timeoutMs: 10 }));

    await expect(run).rejects.toMatchObject({ kind: 'timeout', message: 'The AI took too long to answer. Try again.' });
  });

  it('Claude: a safety refusal', async () => {
    const { fetchImpl } = fakeFetch(200, { stop_reason: 'refusal', stop_details: { category: null }, content: [] });
    expect(await kindOf(ADAPTERS.claude(request({ fetch: fetchImpl })))).toBe('refused');
  });

  it('OpenAI: a safety refusal', async () => {
    const { fetchImpl } = fakeFetch(200, {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'I cannot help with that.' }] }],
    });
    expect(await kindOf(ADAPTERS.openai(request({ fetch: fetchImpl })))).toBe('refused');
  });

  it('Gemini: an answer with no text is treated as a refusal', async () => {
    const { fetchImpl } = fakeFetch(200, { status: 'completed', steps: [] });
    expect(await kindOf(ADAPTERS.gemini(request({ fetch: fetchImpl })))).toBe('refused');
  });

  it.each([
    ['claude', { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"user' }] }],
    ['openai', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }],
    ['gemini', { status: 'incomplete', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"us' }] }] }],
  ] as const)('%s: an answer that was cut off is unreadable', async (provider, body) => {
    const { fetchImpl } = fakeFetch(200, body);
    expect(await kindOf(ADAPTERS[provider](request({ fetch: fetchImpl })))).toBe('unreadable');
  });

  it('keeps the provider\'s own error text for the developer, not for the user', async () => {
    const { fetchImpl } = fakeFetch(404, { error: { type: 'not_found_error', message: 'model: the-model' } });
    try {
      await ADAPTERS.claude(request({ fetch: fetchImpl }));
      throw new Error('expected a failure');
    } catch (error) {
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).message).toBe('The AI provider did not accept the request.');
      expect((error as EngineError).detail).toContain('claude HTTP 404');
      expect((error as EngineError).detail).toContain('model: the-model');
    }
  });
});

describe('Chat Completions answers (OpenRouter, Groq)', () => {
  const answer = (choice: Record<string, unknown>) => ({ choices: [choice] });

  it('reads an answer sent as a list of parts', async () => {
    const { fetchImpl } = fakeFetch(200, answer({ finish_reason: 'stop', message: { content: [{ type: 'text', text: ANSWER }] } }));
    expect(await ADAPTERS.openrouter(request({ fetch: fetchImpl }))).toBe(ANSWER);
  });

  it('drops thinking that comes before the answer', async () => {
    const { fetchImpl } = fakeFetch(200, answer({ finish_reason: 'stop', message: { content: `<think>hmm</think>\n${ANSWER}` } }));
    expect(await ADAPTERS.groq(request({ fetch: fetchImpl }))).toBe(ANSWER);
  });

  it.each([
    ['a refusal', { finish_reason: 'stop', message: { content: null, refusal: 'I cannot help with that.' } }, 'refused'],
    ['a content filter', { finish_reason: 'content_filter', message: { content: '' } }, 'refused'],
    ['an answer cut off at the length limit', { finish_reason: 'length', message: { content: '{"user' } }, 'unreadable'],
    ['no text', { finish_reason: 'stop', message: { content: '' } }, 'unreadable'],
    ['a failure mid-answer', { finish_reason: 'error', error: { code: 502, message: 'upstream' }, message: { content: '' } }, 'provider_down'],
  ] as const)('maps %s', async (_name, choice, kind) => {
    const { fetchImpl } = fakeFetch(200, answer(choice));
    expect(await kindOf(ADAPTERS.openrouter(request({ fetch: fetchImpl })))).toBe(kind);
  });

  it('OpenRouter: an error inside a 200 answer counts as that error', async () => {
    const { fetchImpl } = fakeFetch(200, { error: { code: 429, message: 'Rate limit exceeded: free-models-per-day' } });
    const run = ADAPTERS.openrouter(request({ fetch: fetchImpl }));
    await expect(run).rejects.toMatchObject({ kind: 'limit', limit: { daily: true } });
  });

  it('OpenRouter: a busy free host is a short rest with its own message, not the key\'s limit (its answer on 2026-11-26)', async () => {
    const { fetchImpl } = fakeFetch(429, {
      error: {
        message: 'Provider returned error',
        code: 429,
        metadata: {
          raw: 'inclusionai/ling-3.2-flash:free is temporarily rate-limited upstream. Please retry shortly, or add your own provider key to use your own limits.',
          provider_error_code: 'TooManyRequests',
          limit_source: 'upstream_provider_shared_pool',
        },
      },
    });
    await expect(ADAPTERS.openrouter(request({ fetch: fetchImpl }))).rejects.toMatchObject({
      kind: 'limit',
      message: "OpenRouter's free model is busy right now. Try again in a minute.",
      limit: { retryAfterMs: 60_000 },
    });
  });

  it('OpenRouter: no credit (402)', async () => {
    const { fetchImpl } = fakeFetch(402, { error: { code: 402, message: 'Insufficient credits' } });
    expect(await kindOf(ADAPTERS.openrouter(request({ fetch: fetchImpl })))).toBe('no_credit');
  });

  it('OpenRouter: its moderation flagging the request is a refusal, not a wrong key', async () => {
    const { fetchImpl } = fakeFetch(403, {
      error: { code: 403, message: 'flagged', metadata: { reasons: ['x'], flagged_input: '...' } },
    });
    expect(await kindOf(ADAPTERS.openrouter(request({ fetch: fetchImpl })))).toBe('refused');
  });

  it('OpenRouter: says how to fix privacy settings that leave no free model to answer', async () => {
    const { fetchImpl } = fakeFetch(404, { error: { code: 404, message: 'No endpoints found matching your data policy' } });
    await expect(ADAPTERS.openrouter(request({ fetch: fetchImpl }))).rejects.toMatchObject({
      kind: 'bad_request',
      message: expect.stringContaining('openrouter.ai/settings/privacy'),
    });
  });

  it.each([408, 498])('a %s is a busy provider', async (status) => {
    const { fetchImpl } = fakeFetch(status, { error: { message: 'busy' } });
    expect(await kindOf(ADAPTERS.groq(request({ fetch: fetchImpl })))).toBe('provider_down');
  });
});

describe('what a limit says about when to try again', () => {
  it('reads Gemini\'s retry time and daily quota (its answer format on 2026-11-26)', () => {
    const body = {
      error: {
        code: 429,
        message: 'You exceeded your current quota. Please retry in 37.56s.',
        status: 'RESOURCE_EXHAUSTED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }],
          },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' },
        ],
      },
    };
    expect(limitHint({ status: 429, body })).toEqual({ daily: true, retryAfterMs: 37_000 });
  });

  it('reads Gemini\'s daily limit with the time until it resets (its answer on 2026-11-27)', () => {
    const body = {
      error: {
        message:
          'Rate limit exceeded for model gemini-4-hydrogen (limit: 20 requests per day on Free Tier). Please retry in 22h38m10s or upgrade.',
        status: 'too_many_requests',
      },
    };
    expect(limitHint({ status: 429, body })).toEqual({ daily: true, retryAfterMs: (22 * 3600 + 38 * 60 + 10) * 1000 });
  });

  it('tells a per-minute limit from a daily one', () => {
    const body = {
      error: {
        details: [
          { violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] },
          { retryDelay: '12s' },
        ],
      },
    };
    expect(limitHint({ status: 429, body })).toEqual({ retryAfterMs: 12_000 });
  });

  it('reads Groq\'s sentence', () => {
    const body = {
      error: {
        message:
          'Rate limit reached for model `qwen/qwen3.8-27b` on requests per day (RPD): Limit 1000, Used 1000. Please try again in 1m26.4s.',
        type: 'requests',
      },
    };
    expect(limitHint({ status: 429, body })).toEqual({ daily: true, retryAfterMs: 86_400 });
  });

  it('Groq: its per-minute token limit is a short limit, not "no credit", though it links to billing (its answer on 2026-11-27)', async () => {
    const body = {
      error: {
        message:
          'Request too large for model `qwen/qwen3.8-27b` in organization `org_x` service tier `on_demand` on output tokens per minute (OTPM): Limit 1000, Requested 1285. The request\'s expected output tokens exceed the enforced limit; reduce max_tokens (or the request\'s expected output) and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing',
        type: 'tokens',
        code: 'rate_limit_exceeded',
      },
    };
    const { fetchImpl } = fakeFetch(429, body);
    await expect(ADAPTERS.groq(request({ fetch: fetchImpl }))).rejects.toMatchObject({
      kind: 'limit',
      limit: { retryAfterMs: 60_000 },
    });
  });

  it('prefers a Retry-After header in seconds', () => {
    expect(limitHint({ status: 429, body: { error: { message: 'slow down' } }, retryAfter: '20' })).toEqual({
      retryAfterMs: 20_000,
    });
  });

  it('says nothing when the provider says nothing', () => {
    expect(limitHint({ status: 429, body: { error: { message: 'slow down' } } })).toEqual({});
  });

  it('passes the header through the adapter', async () => {
    const { fetchImpl } = fakeFetch(429, { error: { message: 'slow down' } }, { 'retry-after': '30' });
    await expect(ADAPTERS.groq(request({ fetch: fetchImpl }))).rejects.toMatchObject({
      kind: 'limit',
      limit: { retryAfterMs: 30_000 },
    });
  });

  it('reads durations the way providers write them', () => {
    expect(parseDuration('37s')).toBe(37_000);
    expect(parseDuration('2m10.5s')).toBe(130_500);
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration('250ms')).toBe(250);
    expect(parseDuration('soon')).toBeNull();
  });
});
