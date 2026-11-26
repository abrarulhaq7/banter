import { EngineError, cleanUsername, parseModelOutput, schemaFor } from '@/engine';

const lines = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    username: 'some.one',
    screen_type: 'story',
    noticed: 'A ramen bowl by the window.',
    refusal: '',
    sent_line_status: 'unknown',
    lines: [
      { text: 'Where is that ramen from?', hook: 'ramen bowl' },
      { text: 'That window seat looks like the best table.', hook: 'window seat' },
      { text: 'Is this a weekly ritual or a one-off?', hook: 'caption' },
    ],
    ...overrides,
  });

const analysis = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    username: 'some.one',
    screen_type: 'chat',
    noticed: 'Short replies.',
    refusal: '',
    sent_line_status: 'unknown',
    interest: 'low',
    signals: ['One-word replies', 'No questions back'],
    advice: 'Leave it for now.',
    suggested_reply: '',
    ...overrides,
  });

const unreadable = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof EngineError ? error.kind : 'other error';
  }
  return 'no error';
};

describe('parseModelOutput: lines', () => {
  it('reads a correct answer', () => {
    expect(parseModelOutput('story_reply', lines())).toEqual({
      kind: 'lines',
      username: 'some.one',
      screenType: 'story',
      noticed: 'A ramen bowl by the window.',
      sentLineStatus: 'unknown',
      lines: [
        { text: 'Where is that ramen from?', hook: 'ramen bowl' },
        { text: 'That window seat looks like the best table.', hook: 'window seat' },
        { text: 'Is this a weekly ritual or a one-off?', hook: 'caption' },
      ],
    });
  });

  it('finds the answer inside a code block or surrounding words', () => {
    const fenced = 'Here you go:\n```json\n' + lines() + '\n```\nHope that helps!';
    const prose = 'Sure. ' + lines() + ' Let me know.';
    expect(parseModelOutput('opener', fenced).kind).toBe('lines');
    expect(parseModelOutput('opener', prose).kind).toBe('lines');
  });

  it('keeps only three lines', () => {
    const five = Array.from({ length: 5 }, (_, index) => ({ text: `Line ${index}`, hook: 'h' }));
    const output = parseModelOutput('reply', lines({ lines: five }));
    expect(output.kind === 'lines' && output.lines.map((line) => line.text)).toEqual([
      'Line 0',
      'Line 1',
      'Line 2',
    ]);
  });

  it('drops blank and repeated lines', () => {
    const output = parseModelOutput(
      'reply',
      lines({
        lines: [
          { text: '  ', hook: 'x' },
          { text: 'Same line', hook: 'a' },
          { text: 'same line', hook: 'b' },
          { text: 'Another', hook: 'c' },
          null,
        ],
      }),
    );
    expect(output.kind === 'lines' && output.lines.map((line) => line.text)).toEqual(['Same line', 'Another']);
  });

  it('removes quotes the model wrapped around a message', () => {
    const output = parseModelOutput('reply', lines({ lines: [{ text: '"Where is that from?"', hook: 'x' }] }));
    expect(output.kind === 'lines' && output.lines[0].text).toBe('Where is that from?');
  });

  it('accepts fewer than three lines rather than failing', () => {
    const output = parseModelOutput('reply', lines({ lines: [{ text: 'Only one', hook: 'x' }] }));
    expect(output.kind === 'lines' && output.lines).toHaveLength(1);
  });

  it('replaces an unknown screen type and tolerates a missing hook', () => {
    const output = parseModelOutput('reply', lines({ screen_type: 'reel', lines: [{ text: 'Hi' }] }));
    expect(output.screenType).toBe('other');
    expect(output.kind === 'lines' && output.lines[0]).toEqual({ text: 'Hi', hook: '' });
  });

  it.each([
    ['not JSON at all', 'I cannot help with that.'],
    ['a list instead of an object', '[1, 2, 3]'],
    ['no lines and no refusal', lines({ lines: [] })],
    ['lines that are not a list', lines({ lines: 'three good ones' })],
  ])('reports an unreadable answer: %s', (_name, raw) => {
    expect(unreadable(() => parseModelOutput('story_reply', raw))).toBe('unreadable');
  });
});

describe('parseModelOutput: declined', () => {
  it('returns the reason when the model applied a stop condition', () => {
    expect(
      parseModelOutput('opener', lines({ refusal: 'She looks like she may be under 18.', lines: [] })),
    ).toEqual({
      kind: 'declined',
      username: 'some.one',
      screenType: 'story',
      noticed: 'A ramen bowl by the window.',
      sentLineStatus: 'unknown',
      reason: 'She looks like she may be under 18.',
    });
  });

  it('lets a refusal win even if lines were also written', () => {
    expect(parseModelOutput('opener', lines({ refusal: 'She asked him to stop.' })).kind).toBe('declined');
  });
});

describe('parseModelOutput: analysis', () => {
  it('reads a correct analysis and turns an empty reply into "none"', () => {
    expect(parseModelOutput('analyse', analysis())).toEqual({
      kind: 'analysis',
      username: 'some.one',
      screenType: 'chat',
      noticed: 'Short replies.',
      sentLineStatus: 'unknown',
      interest: 'low',
      signals: ['One-word replies', 'No questions back'],
      advice: 'Leave it for now.',
      suggestedReply: null,
    });
  });

  it('keeps a suggested reply and at most five signals', () => {
    const output = parseModelOutput(
      'analyse',
      analysis({ suggested_reply: ' "How was the trip?" ', signals: ['a', 'b', 'c', 'd', 'e', 'f', ''] }),
    );
    expect(output.kind === 'analysis' && output.suggestedReply).toBe('How was the trip?');
    expect(output.kind === 'analysis' && output.signals).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('falls back to "unclear" for an unknown interest level', () => {
    const output = parseModelOutput('analyse', analysis({ interest: 'sky high' }));
    expect(output.kind === 'analysis' && output.interest).toBe('unclear');
  });

  it('needs advice', () => {
    expect(unreadable(() => parseModelOutput('analyse', analysis({ advice: ' ' })))).toBe('unreadable');
  });
});

describe('parseModelOutput: did she reply', () => {
  it.each(['replied', 'no_reply', 'unknown'] as const)('reads "%s"', (status) => {
    expect(parseModelOutput('reply', lines({ sent_line_status: status })).sentLineStatus).toBe(status);
    expect(parseModelOutput('analyse', analysis({ sent_line_status: status })).sentLineStatus).toBe(status);
  });

  it('treats a missing or odd value as "unknown", so a result is never set by mistake', () => {
    expect(parseModelOutput('reply', lines({ sent_line_status: 'maybe' })).sentLineStatus).toBe('unknown');
    expect(parseModelOutput('reply', lines({ sent_line_status: undefined })).sentLineStatus).toBe('unknown');
  });
});

describe('cleanUsername', () => {
  it.each([
    ['Some.One_99', 'some.one_99'],
    ['@some.one', 'some.one'],
    ['  some.one  ', 'some.one'],
  ])('accepts %p as %p', (raw, expected) => {
    expect(cleanUsername(raw)).toBe(expected);
  });

  it.each(['', 'has spaces', 'emoji😀', 'x'.repeat(31), 'unknown user', null, 42])(
    'rejects %p',
    (raw) => {
      expect(cleanUsername(raw)).toBeNull();
    },
  );
});

describe('schemaFor', () => {
  /** Rules all three providers accept: every field required, no extras, no nulls. */
  function check(node: unknown): void {
    if (typeof node !== 'object' || node === null) return;
    const schema = node as Record<string, unknown>;
    if (schema.type === 'object') {
      const properties = Object.keys(schema.properties as object);
      expect(schema.additionalProperties).toBe(false);
      expect([...(schema.required as string[])].sort()).toEqual([...properties].sort());
      Object.values(schema.properties as object).forEach(check);
    }
    if (schema.type === 'array') check(schema.items);
    expect(typeof schema.type).toBe('string');
    for (const banned of ['minItems', 'maxItems', 'minLength', 'maxLength', 'minimum', 'maximum']) {
      expect(schema).not.toHaveProperty(banned);
    }
  }

  it.each(['story_reply', 'opener', 'reply', 'analyse'] as const)('%s uses a portable schema', (mode) => {
    check(schemaFor(mode).schema);
  });

  it('uses the analysis structure only for Analyse', () => {
    expect(schemaFor('analyse').name).toBe('banter_analysis');
    expect(schemaFor('reply').name).toBe('banter_lines');
  });
});
