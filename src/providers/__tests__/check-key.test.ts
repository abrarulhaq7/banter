import { checkKey } from '@/providers/check-key';

type Call = { url: string; init: RequestInit };

/** A fetch that records what it was asked and answers with the given status and body. */
function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (typeof body === 'string') throw new SyntaxError('not json');
        return body;
      },
    };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

// The exact answers each provider gave to a made-up key on 2026-11-25.
const CLAUDE_BAD_KEY = {
  type: 'error',
  error: { type: 'authentication_error', message: 'invalid x-api-key' },
  request_id: 'req_x',
};
const OPENAI_BAD_KEY = {
  error: {
    message: 'Incorrect API key provided: sk-not-a*****-key.',
    type: 'invalid_request_error',
    param: null,
    code: 'invalid_api_key',
  },
};
const GEMINI_BAD_KEY = {
  error: {
    code: 400,
    message: 'API key not valid. Please pass a valid API key.',
    status: 'INVALID_ARGUMENT',
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }],
  },
};

describe('checkKey: a working key', () => {
  it('accepts a Claude key and lists its models', async () => {
    const { fetchImpl, calls } = fakeFetch(200, {
      data: [{ id: 'claude-haiku-5-5' }, { id: 'claude-opus-5-5' }],
      has_more: false,
    });

    const result = await checkKey('claude', 'sk-ant-test', { fetch: fetchImpl });

    expect(result).toEqual({ ok: true, modelIds: ['claude-haiku-5-5', 'claude-opus-5-5'] });
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/models?limit=1000');
    expect(calls[0].init.headers).toEqual({
      'x-api-key': 'sk-ant-test',
      'anthropic-version': '2026-10-21',
    });
  });

  it('accepts an OpenAI key and lists its models', async () => {
    const { fetchImpl, calls } = fakeFetch(200, { object: 'list', data: [{ id: 'gpt-6-luna' }] });

    const result = await checkKey('openai', 'sk-test', { fetch: fetchImpl });

    expect(result).toEqual({ ok: true, modelIds: ['gpt-6-luna'] });
    expect(calls[0].url).toBe('https://api.openai.com/v1/models');
    expect(calls[0].init.headers).toEqual({ Authorization: 'Bearer sk-test' });
  });

  it('accepts a Gemini key and removes the "models/" prefix from model names', async () => {
    const { fetchImpl, calls } = fakeFetch(200, {
      models: [{ name: 'models/gemini-3.5-flash-lite' }, { name: 'models/gemini-4-hydrogen' }],
    });

    const result = await checkKey('gemini', 'AIzaTest', { fetch: fetchImpl });

    expect(result).toEqual({ ok: true, modelIds: ['gemini-3.5-flash-lite', 'gemini-4-hydrogen'] });
    expect(calls[0].init.headers).toEqual({ 'x-goog-api-key': 'AIzaTest' });
  });

  it('never puts the key in the address, where it could end up in logs', async () => {
    for (const provider of ['claude', 'openai', 'gemini'] as const) {
      const { fetchImpl, calls } = fakeFetch(200, { data: [], models: [] });
      await checkKey(provider, 'SECRET-KEY-VALUE', { fetch: fetchImpl });
      expect(calls[0].url).not.toContain('SECRET-KEY-VALUE');
      expect(calls[0].init.method).toBe('GET');
    }
  });

  it('ignores spaces and line breaks around a pasted key', async () => {
    const { fetchImpl, calls } = fakeFetch(200, { data: [] });
    await checkKey('openai', '  sk-test\n', { fetch: fetchImpl });
    expect(calls[0].init.headers).toEqual({ Authorization: 'Bearer sk-test' });
  });
});

describe('checkKey: a wrong key', () => {
  it.each([
    ['claude', 401, CLAUDE_BAD_KEY, 'Claude'],
    ['openai', 401, OPENAI_BAD_KEY, 'OpenAI'],
    ['gemini', 400, GEMINI_BAD_KEY, 'Gemini'],
  ] as const)('%s rejects it', async (provider, status, body, name) => {
    const result = await checkKey(provider, 'wrong-key', { fetch: fakeFetch(status, body).fetchImpl });

    expect(result).toEqual({
      ok: false,
      reason: 'invalid',
      message: `${name} rejected this key. Check that you copied all of it and that it belongs to ${name}.`,
    });
  });

  it('recognises Gemini\'s wrong-key answer when it comes wrapped in a list', async () => {
    const result = await checkKey('gemini', 'k', { fetch: fakeFetch(400, [GEMINI_BAD_KEY]).fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('treats "not allowed" (403) as a rejected key', async () => {
    const result = await checkKey('gemini', 'k', {
      fetch: fakeFetch(403, { error: { status: 'PERMISSION_DENIED' } }).fetchImpl,
    });
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('does not show the provider\'s raw text, which can contain part of the key', async () => {
    const result = await checkKey('openai', 'sk-not-a-real-key', {
      fetch: fakeFetch(401, OPENAI_BAD_KEY).fetchImpl,
    });
    expect(result.ok === false && result.message).not.toContain('sk-not-a');
  });

  it('does not mistake another Gemini 400 for a wrong key', async () => {
    const result = await checkKey('gemini', 'k', {
      fetch: fakeFetch(400, { error: { status: 'INVALID_ARGUMENT', message: 'Bad page size' } }).fetchImpl,
    });
    expect(result).toMatchObject({ ok: false, reason: 'unexpected' });
  });
});

describe('checkKey: other problems', () => {
  it('reports a key at its limit', async () => {
    const result = await checkKey('openai', 'k', { fetch: fakeFetch(429, { error: {} }).fetchImpl });
    expect(result).toEqual({
      ok: false,
      reason: 'limited',
      message: 'This OpenAI key is at its limit right now. Wait a minute and try again.',
    });
  });

  it('reports a key with no credit', async () => {
    const result = await checkKey('claude', 'k', {
      fetch: fakeFetch(402, { type: 'error', error: { type: 'billing_error' } }).fetchImpl,
    });
    expect(result).toMatchObject({ ok: false, reason: 'limited' });
    expect(result.ok === false && result.message).toContain('no credit');
  });

  it.each([500, 503, 529])('reports provider trouble on %i', async (status) => {
    const result = await checkKey('claude', 'k', { fetch: fakeFetch(status, 'gateway error page').fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: 'provider_down' });
  });

  it('reports no internet when the request cannot be sent', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    expect(await checkKey('gemini', 'k', { fetch: fetchImpl })).toEqual({
      ok: false,
      reason: 'no_internet',
      message: 'Could not reach Gemini. Check your internet and try again.',
    });
  });

  it('gives up when the provider takes too long', async () => {
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;

    const result = await checkKey('openai', 'k', { fetch: fetchImpl, timeoutMs: 10 });

    expect(result).toMatchObject({ ok: false, reason: 'no_internet' });
    expect(result.ok === false && result.message).toContain('took too long');
  });

  it.each([
    ['a page that is not JSON', 200, '<html>'],
    ['JSON without a model list', 200, { hello: 'world' }],
    ['an unknown status', 418, {}],
  ])('reports an answer it does not understand: %s', async (_name, status, body) => {
    const result = await checkKey('claude', 'k', { fetch: fakeFetch(status, body).fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: 'unexpected' });
  });
});
