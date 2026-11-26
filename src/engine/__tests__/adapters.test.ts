import { ADAPTERS, EngineError, schemaFor, type AdapterRequest } from '@/engine';
import type { ProviderId } from '@/lib/database.types';

type Call = { url: string; headers: Record<string, string>; body: Record<string, any> };

function fakeFetch(status: number, responseBody: unknown) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string),
    });
    return {
      status,
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
};

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

  it.each(['claude', 'openai', 'gemini'] as const)('%s: the key is never in the address or the body', async (provider) => {
    const { fetchImpl, calls } = fakeFetch(200, OK[provider]);
    await ADAPTERS[provider](request({ fetch: fetchImpl }));

    expect(calls[0].url).not.toContain('SECRET-KEY');
    expect(JSON.stringify(calls[0].body)).not.toContain('SECRET-KEY');
  });
});

describe('adapters: problems are mapped to the same plain cases', () => {
  const providers = ['claude', 'openai', 'gemini'] as const;

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

    await expect(run).rejects.toMatchObject({ kind: 'no_internet', message: 'The AI took too long to answer. Try again.' });
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
