import { createOutbox, type GenerationEntry, type QueuedEntry } from '@/history';
import { createFakeHistoryRepo, createMemoryCache } from '@/test-utils';

const generation = (id: string, overrides: Partial<GenerationEntry> = {}): GenerationEntry => ({
  kind: 'generation',
  username: 'some.one',
  context: 'stranger',
  interaction: {
    id,
    parent_id: null,
    adjustment: null,
    mode_id: 'story_reply',
    tone_id: 'casual',
    tone_label: 'Casual',
    context: 'stranger',
    screenshot_path: 'user/shot.jpg',
    screen_type: 'story',
    noticed: 'pho',
    analysis: null,
    provider: 'gemini',
    model: 'm',
    api_key_id: 'key-1',
    api_key_label: 'Main',
    prompt_version: 5,
    duration_ms: 2000,
    created_at: '2026-11-25T12:00:00Z',
  },
  lines: [
    { id: `${id}-l1`, interaction_id: id, position: 1, text: 'One', hook: 'a' },
    { id: `${id}-l2`, interaction_id: id, position: 2, text: 'Two', hook: 'b' },
  ],
  screenshot: { path: 'user/shot.jpg', localUri: 'file:///shot.jpg' },
  ...overrides,
});

function setup(saved: QueuedEntry[] | null = null) {
  const fake = createFakeHistoryRepo();
  const memory = createMemoryCache<QueuedEntry[]>(saved);
  const outbox = createOutbox({ repo: fake.repo, cache: memory.cache, now: () => new Date('2026-11-25T12:00:00Z') });
  return { fake, memory, outbox };
}

const offline = () => new TypeError('Network request failed');
const refused = () => ({ code: '23514', message: 'violates check constraint', status: 400 });

describe('outbox: saving a generation', () => {
  it('saves the person, the screenshot, the interaction and its lines', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));

    expect(await outbox.flush()).toEqual({ sent: 1, waiting: 0, problem: null });

    expect(fake.people.map((person) => [person.username, person.context])).toEqual([['some.one', 'stranger']]);
    expect(fake.files.get('user/shot.jpg')).toBe('file:///shot.jpg');
    expect(fake.interactions[0]).toMatchObject({ id: 'i1', person_id: 'person-1', screenshot_path: 'user/shot.jpg' });
    expect(fake.lines.map((line) => line.text)).toEqual(['One', 'Two']);
  });

  it('uploads a screenshot once, however many sets are made from it', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));
    await outbox.add(generation('i2'));
    await outbox.flush();

    expect(fake.repo.uploadScreenshot).toHaveBeenCalledTimes(1);
    expect(fake.interactions.map((row) => row.screenshot_path)).toEqual(['user/shot.jpg', 'user/shot.jpg']);
  });

  it('saves without a person when the username could not be read', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1', { username: null }));
    await outbox.flush();

    expect(fake.people).toEqual([]);
    expect(fake.interactions[0].person_id).toBeNull();
  });

  it('still saves the lines when the screenshot file is gone from the phone', async () => {
    const { fake, outbox } = setup();
    (fake.repo.uploadScreenshot as jest.Mock).mockRejectedValueOnce({ status: 400, message: 'invalid file' });
    await outbox.add(generation('i1'));

    expect(await outbox.flush()).toMatchObject({ sent: 1, waiting: 0 });
    expect(fake.interactions[0].screenshot_path).toBeNull();
    expect(fake.lines).toHaveLength(2);
  });
});

describe('outbox: no connection', () => {
  it('keeps everything on the phone and says why', async () => {
    const { fake, memory, outbox } = setup();
    await outbox.add(generation('i1'));
    fake.failNext(offline());

    expect(await outbox.flush()).toEqual({
      sent: 0,
      waiting: 1,
      problem: 'No connection. Check your internet and try again.',
    });
    expect(memory.current()).toHaveLength(1);
    expect(fake.interactions).toEqual([]);
  });

  it('sends it on the next try, with nothing saved twice', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));
    // The person is saved, then the connection drops before the interaction.
    (fake.repo.saveInteraction as jest.Mock).mockRejectedValueOnce(offline());
    await outbox.flush();

    expect(await outbox.flush()).toEqual({ sent: 1, waiting: 0, problem: null });
    expect(fake.people).toHaveLength(1);
    expect(fake.interactions).toHaveLength(1);
    expect(fake.lines).toHaveLength(2);
    expect(fake.repo.uploadScreenshot).toHaveBeenCalledTimes(1);
  });

  it('survives the app being closed: a new outbox picks up what was waiting', async () => {
    const first = setup();
    await first.outbox.add(generation('i1'));
    first.fake.failNext(offline());
    await first.outbox.flush();

    const second = setup(first.memory.current());
    expect(await second.outbox.waiting()).toBe(1);
    expect(await second.outbox.flush()).toMatchObject({ sent: 1, waiting: 0 });
    expect(second.fake.interactions).toHaveLength(1);
  });

  it('keeps the order: a later change waits behind the one that could not be sent', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));
    await outbox.add({ kind: 'linePatch', lineId: 'i1-l1', patch: { copied_at: '2026-11-25T12:01:00Z' } });
    fake.failNext(offline());

    expect(await outbox.flush()).toMatchObject({ sent: 0, waiting: 2 });
    expect(fake.repo.patchLine).not.toHaveBeenCalled();

    await outbox.flush();
    expect(fake.lines.find((line) => line.id === 'i1-l1')?.copied_at).toBe('2026-11-25T12:01:00Z');
  });

  it('treats a server having trouble as temporary too', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));
    fake.failNext({ status: 503, message: 'upstream unavailable' });

    expect(await outbox.flush()).toMatchObject({ sent: 0, waiting: 1 });
  });
});

describe('outbox: an entry the database refuses for good', () => {
  it('is dropped so it cannot block everything behind it', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('bad'));
    await outbox.add(generation('good'));
    fake.failNext(refused());

    expect(await outbox.flush()).toEqual({ sent: 1, waiting: 0, problem: null });
    expect(fake.interactions.map((row) => row.id)).toEqual(['good']);
  });
});

describe('outbox: other changes', () => {
  it('marks a line as copied, kept and replied', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));
    await outbox.add({ kind: 'linePatch', lineId: 'i1-l1', patch: { copied_at: 't1' } });
    await outbox.add({ kind: 'linePatch', lineId: 'i1-l1', patch: { kept_at: 't2' } });
    await outbox.add({ kind: 'linePatch', lineId: 'i1-l1', patch: { result: 'replied', result_at: 't3' } });
    await outbox.flush();

    expect(fake.lines.find((line) => line.id === 'i1-l1')).toMatchObject({
      copied_at: 't1',
      kept_at: 't2',
      result: 'replied',
      result_at: 't3',
    });
  });

  it('does not undo a "copied" mark when a generation is sent a second time', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));
    await outbox.add({ kind: 'linePatch', lineId: 'i1-l1', patch: { copied_at: 't1' } });
    await outbox.flush();

    await outbox.add(generation('i1'));
    await outbox.flush();

    expect(fake.lines.find((line) => line.id === 'i1-l1')?.copied_at).toBe('t1');
    expect(fake.lines).toHaveLength(2);
  });

  it('moves interactions to the corrected person, creating her if needed', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));
    await outbox.add(generation('i2'));
    await outbox.add({ kind: 'assignPerson', interactionIds: ['i1', 'i2'], username: 'the.right.one', context: null });
    await outbox.flush();

    const right = fake.people.find((person) => person.username === 'the.right.one');
    expect(right).toBeDefined();
    expect(fake.interactions.map((row) => row.person_id)).toEqual([right?.id, right?.id]);
  });

  it('removes a misread person once nothing is saved under them', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));
    await outbox.add({
      kind: 'assignPerson',
      interactionIds: ['i1'],
      username: 'the.right.one',
      context: null,
      previousUsername: 'some.one',
    });
    await outbox.flush();

    expect(fake.people.map((person) => person.username)).toEqual(['the.right.one']);
  });

  it('keeps the earlier person when other interactions are still saved under them', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));
    await outbox.add(generation('i2'));
    await outbox.add({
      kind: 'assignPerson',
      interactionIds: ['i2'],
      username: 'the.right.one',
      context: null,
      previousUsername: 'some.one',
    });
    await outbox.flush();

    expect(fake.people.map((person) => person.username).sort()).toEqual(['some.one', 'the.right.one']);
  });

  it('remembers how the user knows someone', async () => {
    const { fake, outbox } = setup();
    await outbox.add({ kind: 'personContext', username: 'some.one', context: 'know_her' });
    await outbox.flush();

    expect(fake.people[0]).toMatchObject({ username: 'some.one', context: 'know_her' });
  });

  it('sends one thing at a time even when asked twice at once', async () => {
    const { fake, outbox } = setup();
    await outbox.add(generation('i1'));

    const [first, second] = await Promise.all([outbox.flush(), outbox.flush()]);

    expect(first).toEqual(second);
    expect(fake.repo.saveInteraction).toHaveBeenCalledTimes(1);
  });
});
