import {
  DEFAULT_CORE,
  DEFAULT_MODES,
  DEFAULT_TONES,
  EngineError,
  generate,
  type Adapter,
  type AdapterRequest,
  type KeyCandidate,
  type KeyProblem,
  type PromptInput,
} from '@/engine';

const prompt: PromptInput = {
  core: DEFAULT_CORE,
  mode: 'story_reply',
  modeInstruction: DEFAULT_MODES.story_reply.instruction,
  tone: DEFAULT_TONES.casual,
};
const image = { base64: 'QUJD', mediaType: 'image/jpeg' as const };

const GOOD = JSON.stringify({
  username: 'some.one',
  screen_type: 'story',
  noticed: 'ramen',
  refusal: '',
  lines: [
    { text: 'One', hook: 'a' },
    { text: 'Two', hook: 'b' },
    { text: 'Three', hook: 'c' },
  ],
});

const key = (id: string, provider: KeyCandidate['provider'] = 'gemini'): KeyCandidate => ({
  id,
  label: `Key ${id}`,
  provider,
  key: `secret-${id}`,
  model: `${provider}-model`,
});

/** An adapter that plays back the given outcomes, one per call. */
function scripted(...outcomes: (string | EngineError)[]) {
  const calls: AdapterRequest[] = [];
  const adapter: Adapter = async (request) => {
    calls.push(request);
    const outcome = outcomes[Math.min(calls.length - 1, outcomes.length - 1)];
    if (outcome instanceof EngineError) throw outcome;
    return outcome;
  };
  return { adapter, calls };
}

const noWait = async () => {};

const run = (keys: KeyCandidate[], adapter: Adapter, onKeyProblem?: (problem: KeyProblem) => void) =>
  generate({
    keys,
    prompt,
    image,
    onKeyProblem,
    adapters: { gemini: adapter, openai: adapter, claude: adapter },
    sleep: noWait,
  });

describe('generate', () => {
  it('returns the checked answer and which key, model and prompt version were used', async () => {
    const { adapter, calls } = scripted(GOOD);
    const times = [1000, 3500];

    const result = await generate({
      keys: [key('a')],
      prompt,
      image,
      adapters: { gemini: adapter },
      now: () => times.shift()!,
    });

    expect(result.output).toMatchObject({ kind: 'lines', username: 'some.one' });
    expect(result.usedKey).toEqual({ id: 'a', label: 'Key a', provider: 'gemini', model: 'gemini-model' });
    expect(result.promptVersion).toBe(DEFAULT_CORE.version);
    expect(result.durationMs).toBe(2500);
    expect(calls[0]).toMatchObject({ key: 'secret-a', model: 'gemini-model', image });
    expect(calls[0].system).toContain('Stop conditions');
    expect(calls[0].schema.name).toBe('banter_lines');
  });

  it('moves to the next key when one hits its limit, and reports the limited key', async () => {
    const { adapter, calls } = scripted(new EngineError('limit'), GOOD);
    const problems: KeyProblem[] = [];

    const result = await run([key('a'), key('b')], adapter, (problem) => problems.push(problem));

    expect(result.usedKey.id).toBe('b');
    expect(calls.map((call) => call.key)).toEqual(['secret-a', 'secret-b']);
    expect(problems).toEqual([{ keyId: 'a', status: 'limited', message: 'This key has reached its limit.' }]);
  });

  it('moves to the next key when one is rejected, and reports it as invalid', async () => {
    const { adapter } = scripted(new EngineError('wrong_key'), GOOD);
    const problems: KeyProblem[] = [];

    const result = await run([key('a'), key('b')], adapter, (problem) => problems.push(problem));

    expect(result.usedKey.id).toBe('b');
    expect(problems).toEqual([expect.objectContaining({ keyId: 'a', status: 'invalid' })]);
  });

  it('says every key is at its limit when all of them are', async () => {
    const { adapter } = scripted(new EngineError('limit'));
    const problems: KeyProblem[] = [];

    await expect(run([key('a'), key('b')], adapter, (problem) => problems.push(problem))).rejects.toMatchObject({
      kind: 'limit',
      message: 'None of your keys can be used right now. They are at their limit or out of credit.',
    });
    expect(problems.map((problem) => problem.keyId)).toEqual(['a', 'b']);
  });

  it('says a single key is out of credit, and marks it so it is skipped next time', async () => {
    const { adapter } = scripted(new EngineError('no_credit'));
    const problems: KeyProblem[] = [];

    await expect(run([key('a')], adapter, (problem) => problems.push(problem))).rejects.toMatchObject({
      kind: 'no_credit',
      message: 'This key has no credit left. Add credit with the provider, then try again.',
    });
    expect(problems).toEqual([expect.objectContaining({ keyId: 'a', status: 'limited' })]);
  });

  it('moves on from a key with no credit to one that works', async () => {
    const { adapter } = scripted(new EngineError('no_credit'), GOOD);
    const result = await run([key('a'), key('b')], adapter);
    expect(result.usedKey.id).toBe('b');
  });

  it('words the limit message for a single key', async () => {
    const { adapter } = scripted(new EngineError('limit'));
    await expect(run([key('a')], adapter)).rejects.toMatchObject({ message: 'Your key has reached its limit.' });
  });

  it('asks once more when the answer comes back in the wrong shape', async () => {
    const { adapter, calls } = scripted('sorry, here are some ideas', GOOD);

    const result = await run([key('a')], adapter);

    expect(result.output.kind).toBe('lines');
    expect(calls).toHaveLength(2);
    expect(calls[1].key).toBe('secret-a');
  });

  it('gives up after two unreadable answers, without burning the other keys', async () => {
    const { adapter, calls } = scripted('nope', 'still nope');

    await expect(run([key('a'), key('b')], adapter)).rejects.toMatchObject({ kind: 'unreadable' });
    expect(calls.map((call) => call.key)).toEqual(['secret-a', 'secret-a']);
  });

  it('does not shop a refusal around to other keys', async () => {
    const { adapter, calls } = scripted(new EngineError('refused'));
    const problems: KeyProblem[] = [];

    await expect(run([key('a'), key('b')], adapter, (problem) => problems.push(problem))).rejects.toMatchObject({
      kind: 'refused',
    });
    expect(calls).toHaveLength(1);
    expect(problems).toEqual([]);
  });

  it('stops at once without internet, and does not blame the key', async () => {
    const { adapter, calls } = scripted(new EngineError('no_internet'));
    const problems: KeyProblem[] = [];

    await expect(run([key('a'), key('b')], adapter, (problem) => problems.push(problem))).rejects.toMatchObject({
      kind: 'no_internet',
    });
    expect(calls).toHaveLength(1);
    expect(problems).toEqual([]);
  });

  it('asks a busy provider again, waiting longer each time', async () => {
    const { adapter, calls } = scripted(new EngineError('provider_down'), new EngineError('provider_down'), GOOD);
    const waits: number[] = [];

    const result = await generate({
      keys: [key('a')],
      prompt,
      image,
      adapters: { gemini: adapter },
      sleep: async (ms) => void waits.push(ms),
    });

    expect(result.output.kind).toBe('lines');
    expect(calls).toHaveLength(3);
    expect(waits).toEqual([1500, 4000]);
  });

  it('tries another provider when one is down, without marking the key', async () => {
    const down = scripted(new EngineError('provider_down'));
    const up = scripted(GOOD);
    const problems: KeyProblem[] = [];

    const result = await generate({
      keys: [key('a', 'gemini'), key('b', 'openai')],
      prompt,
      image,
      onKeyProblem: (problem) => void problems.push(problem),
      adapters: { gemini: down.adapter, openai: up.adapter },
      sleep: noWait,
    });

    expect(down.calls).toHaveLength(3);

    expect(result.usedKey).toMatchObject({ id: 'b', provider: 'openai' });
    expect(problems).toEqual([]);
  });

  it('reports the provider problem when no key could get through', async () => {
    const { adapter } = scripted(new EngineError('provider_down'));
    await expect(run([key('a')], adapter)).rejects.toMatchObject({ kind: 'provider_down' });
  });

  it('turns an unexpected crash inside an adapter into a plain error, never a raw exception', async () => {
    const adapter: Adapter = async () => {
      throw new TypeError("Cannot read properties of undefined (reading 'content')");
    };

    await expect(run([key('a')], adapter)).rejects.toMatchObject({
      name: 'EngineError',
      kind: 'unreadable',
      message: 'The AI gave an answer Banter could not read. Try again.',
      detail: expect.stringContaining('Cannot read properties'),
    });
  });

  it('asks for a key when there is none', async () => {
    const { adapter, calls } = scripted(GOOD);
    await expect(run([], adapter)).rejects.toMatchObject({ kind: 'no_keys', message: 'Add an AI key to start.' });
    expect(calls).toHaveLength(0);
  });

  it('passes a decline from the model through as an answer, not an error', async () => {
    const declined = JSON.stringify({
      username: '',
      screen_type: 'other',
      noticed: '',
      refusal: 'This is not an Instagram screenshot.',
      lines: [],
    });
    const { adapter } = scripted(declined);

    const result = await run([key('a')], adapter);

    expect(result.output).toMatchObject({ kind: 'declined', reason: 'This is not an Instagram screenshot.' });
  });

  it('uses the analysis structure for Analyse', async () => {
    const analysis = JSON.stringify({
      username: 'x',
      screen_type: 'chat',
      noticed: 'n',
      refusal: '',
      interest: 'high',
      signals: ['asks questions'],
      advice: 'Keep going.',
      suggested_reply: 'How was it?',
    });
    const { adapter, calls } = scripted(analysis);

    const result = await generate({
      keys: [key('a')],
      prompt: { ...prompt, mode: 'analyse', modeInstruction: DEFAULT_MODES.analyse.instruction },
      image,
      adapters: { gemini: adapter },
    });

    expect(result.output).toMatchObject({ kind: 'analysis', interest: 'high', suggestedReply: 'How was it?' });
    expect(calls[0].schema.name).toBe('banter_analysis');
  });
});
