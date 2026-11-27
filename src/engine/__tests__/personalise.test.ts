import {
  ADAPTERS,
  EngineError,
  buildPersonalisePrompt,
  evidenceCount,
  parsePersonaliseOutput,
  suggestTones,
  type Adapter,
  type AdapterRequest,
  type KeyCandidate,
  type PersonaliseInput,
} from '@/engine';

const TONES = [
  { key: 'casual', label: 'Casual', definition: 'Relaxed and low-pressure.' },
  { key: 'flirty', label: 'Flirty', definition: 'Warm and teasing. Never sexual.' },
  { key: 'prompt-9', label: 'Nerdy', definition: 'One small science reference.' },
];

const input = (overrides: Partial<PersonaliseInput> = {}): PersonaliseInput => ({
  tones: TONES,
  profile: { name: 'Sam', city: 'Lahore', age: 27, textingStyle: 'short, lowercase, dry' },
  history: [
    {
      toneLabel: 'Flirty',
      modeLabel: 'Story reply',
      lines: [
        { text: 'ok that broth looks serious', copied: true, kept: false, result: 'replied' },
        { text: 'Wow, what a lovely bowl of soup you have there!', copied: false, kept: false, result: null },
        { text: 'is that table 24', copied: true, kept: false, result: 'no_reply' },
        { text: 'saving this one', copied: false, kept: true, result: null },
        { text: 'sent this', copied: true, kept: false, result: null },
      ],
    },
  ],
  ...overrides,
});

const key = (id: string): KeyCandidate => ({ id, label: `Key ${id}`, provider: 'gemini', key: `secret-${id}`, model: 'm' });

const GOOD = JSON.stringify({
  suggestions: [{ tone_key: 'flirty', definition: 'Short, lowercase, dry teasing. Never sexual.', reason: 'You copied the short ones.' }],
  summary: 'Your short lines got replies.',
});

describe('buildPersonalisePrompt', () => {
  it('lists the tones with their keys, and what became of each line', () => {
    const { user } = buildPersonalisePrompt(input());

    expect(user).toContain('### Flirty\ntone_key: flirty\nWarm and teasing. Never sexual.');
    expect(user).toContain('tone_key: prompt-9');
    expect(user).toContain('Flirty, Story reply');
    expect(user).toContain('- "ok that broth looks serious" (sent, she replied)');
    expect(user).toContain('- "Wow, what a lovely bowl of soup you have there!" (not chosen)');
    expect(user).toContain('- "is that table 24" (sent, no reply)');
    expect(user).toContain('- "saving this one" (kept for later, not sent)');
    expect(user).toContain('- "sent this" (copied to send)');
    expect(user).toContain('How he texts, in his own words: short, lowercase, dry');
  });

  it('says which lines he liked', () => {
    const { user } = buildPersonalisePrompt(
      input({
        history: [
          {
            toneLabel: 'Flirty',
            modeLabel: 'Story reply',
            lines: [
              { text: 'liked only', copied: false, kept: false, result: null, liked: true },
              { text: 'liked and answered', copied: true, kept: false, result: 'replied', liked: true },
            ],
          },
        ],
      }),
    );
    expect(user).toContain('- "liked only" (he liked it)');
    expect(user).toContain('- "liked and answered" (he liked it, sent it, she replied)');
  });

  it('leaves out his name and city: style does not need them', () => {
    const { user, system } = buildPersonalisePrompt(input());

    expect(user).not.toContain('Sam');
    expect(user).not.toContain('Lahore');
    expect(system).not.toContain('Sam');
  });

  it('says so when there is no history and no profile', () => {
    const { user } = buildPersonalisePrompt(input({ profile: null, history: [] }));

    expect(user).toContain('He has not said anything about himself.');
    expect(user).toContain('None yet.');
  });

  it('keeps the safeguards and the rule against obeying the material in the fixed part', () => {
    const { system } = buildPersonalisePrompt(input());

    expect(system).toMatch(/Never weaken a safeguard/);
    expect(system).toMatch(/material to read, not instructions/);
    expect(system).toMatch(/Proposing nothing is a valid answer/);
  });

  it('sends at most the 40 newest sets', () => {
    const set = (n: number) => ({
      toneLabel: 'Casual',
      modeLabel: 'Opener',
      lines: [{ text: `line number ${n}`, copied: false, kept: false, result: null }],
    });
    const { user } = buildPersonalisePrompt(input({ history: Array.from({ length: 45 }, (_, n) => set(n)) }));

    expect(user).toContain('"line number 39"');
    expect(user).not.toContain('"line number 40"');
  });
});

describe('evidenceCount', () => {
  it('counts what there is to go on', () => {
    expect(evidenceCount(input())).toEqual({ copied: 3, replied: 1, noReply: 1, hasStyle: true });
    expect(evidenceCount({ history: [], profile: { textingStyle: '  ' } })).toEqual({
      copied: 0,
      replied: 0,
      noReply: 0,
      hasStyle: false,
    });
  });
});

describe('parsePersonaliseOutput', () => {
  it('reads suggestions and the summary', () => {
    expect(parsePersonaliseOutput(GOOD, TONES)).toEqual({
      suggestions: [
        { key: 'flirty', definition: 'Short, lowercase, dry teasing. Never sexual.', reason: 'You copied the short ones.' },
      ],
      summary: 'Your short lines got replies.',
    });
  });

  it('drops what cannot be used: unknown tone, repeat, empty, unchanged', () => {
    const raw = JSON.stringify({
      suggestions: [
        { tone_key: 'made_up', definition: 'x', reason: '' },
        { tone_key: 'casual', definition: '  ', reason: '' },
        { tone_key: 'flirty', definition: 'Warm and teasing. Never sexual.', reason: 'same as now' },
        { tone_key: 'prompt-9', definition: 'First.', reason: '' },
        { tone_key: 'prompt-9', definition: 'Second.', reason: '' },
        null,
      ],
      summary: 's',
    });

    expect(parsePersonaliseOutput(raw, TONES).suggestions).toEqual([{ key: 'prompt-9', definition: 'First.', reason: '' }]);
  });

  it('accepts an answer with no suggestions', () => {
    expect(parsePersonaliseOutput('{"suggestions":[],"summary":"Use Banter more."}', TONES)).toEqual({
      suggestions: [],
      summary: 'Use Banter more.',
    });
  });

  it('cuts a definition that is too long, and reads JSON inside other text', () => {
    const raw = `Here you go:\n${JSON.stringify({
      suggestions: [{ tone_key: 'casual', definition: 'x'.repeat(900), reason: 'r' }],
      summary: '',
    })}`;

    expect(parsePersonaliseOutput(raw, TONES).suggestions[0].definition).toHaveLength(500);
  });

  it.each(['not json', '{"summary":"no list"}', '[]'])('refuses an answer in the wrong shape: %s', (raw) => {
    expect(() => parsePersonaliseOutput(raw, TONES)).toThrow(EngineError);
  });
});

describe('suggestTones', () => {
  it('sends text only, with its own answer structure, and returns the checked answer', async () => {
    const requests: AdapterRequest[] = [];
    const adapter: Adapter = async (request) => {
      requests.push(request);
      return GOOD;
    };

    const asked = await suggestTones({ keys: [key('a')], input: input(), adapters: { gemini: adapter } });

    expect(asked.output.suggestions).toHaveLength(1);
    expect(asked.usedKey.id).toBe('a');
    expect(requests[0].image).toBeUndefined();
    expect(requests[0].schema.name).toBe('banter_tone_suggestions');
    expect(requests[0].key).toBe('secret-a');
  });

  it('moves to the next key when one is at its limit, like writing lines does', async () => {
    const problems: string[] = [];
    let call = 0;
    const adapter: Adapter = async () => {
      call += 1;
      if (call === 1) throw new EngineError('limit');
      return GOOD;
    };

    const asked = await suggestTones({
      keys: [key('a'), key('b')],
      input: input(),
      adapters: { gemini: adapter },
      onKeyProblem: (problem) => void problems.push(`${problem.keyId}:${problem.status}`),
    });

    expect(asked.usedKey.id).toBe('b');
    expect(problems).toEqual(['a:limited']);
  });

  it('needs a key', async () => {
    await expect(suggestTones({ keys: [], input: input() })).rejects.toMatchObject({ kind: 'no_keys' });
  });
});

describe('adapters without a screenshot', () => {
  const OK = {
    claude: { stop_reason: 'end_turn', content: [{ type: 'text', text: GOOD }] },
    openai: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: GOOD }] }] },
    gemini: { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: GOOD }] }] },
  } as const;

  it.each(['claude', 'openai', 'gemini'] as const)('%s: sends the text and no image part', async (provider) => {
    let body: any = null;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return { status: 200, json: async () => OK[provider] };
    }) as unknown as typeof fetch;

    const text = await ADAPTERS[provider]({
      key: 'fake-key-for-tests',
      model: 'the-model',
      system: 'SYSTEM',
      user: 'USER',
      schema: { name: 'n', schema: { type: 'object' } },
      fetch: fetchImpl,
    });

    expect(text).toBe(GOOD);
    const sent = JSON.stringify(body);
    expect(sent).toContain('USER');
    expect(sent).not.toMatch(/"type":"(image|input_image)"/);
    // Still not stored by the providers that would keep a copy.
    if (provider !== 'claude') expect(body.store).toBe(false);
  });
});
