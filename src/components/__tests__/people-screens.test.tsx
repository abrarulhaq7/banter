import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { PeopleScreen } from '@/components/people/people-screen';
import { PersonScreen } from '@/components/people/person-screen';
import type { QueuedEntry } from '@/history';
import { createFakeHistoryRepo, createMemoryCache, renderWithData } from '@/test-utils';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
});

type Fake = ReturnType<typeof createFakeHistoryRepo>;

/** One person with two sets made from the same screenshot; the first line of the older set was copied. */
async function seed(history: Fake = createFakeHistoryRepo()) {
  const personId = await history.repo.upsertPerson('some.one', 'mutual_follow', '2026-11-25T10:00:00Z');
  const interaction = (id: string, at: string, extra: object = {}) =>
    history.repo.saveInteraction({
      id,
      person_id: personId,
      mode_id: 'story_reply',
      tone_id: 'casual',
      tone_label: 'Casual',
      screen_type: 'story',
      noticed: 'A bowl of pho.',
      screenshot_path: 'user/shot.jpg',
      created_at: at,
      ...extra,
    } as Parameters<Fake['repo']['saveInteraction']>[0]);
  await interaction('first', '2026-11-25T10:00:00Z');
  await interaction('second', '2026-11-25T10:05:00Z', {
    tone_id: 'flirty',
    tone_label: 'Flirty',
    parent_id: 'first',
    adjustment: 'shorter',
  });
  const line = (id: string, interactionId: string, position: number, text: string) => ({
    id,
    interaction_id: interactionId,
    position,
    text,
    hook: null,
  });
  await history.repo.saveLines([
    line('a1', 'first', 1, 'Casual one'),
    line('a2', 'first', 2, 'Casual two'),
    line('b1', 'second', 1, 'Flirty one'),
  ] as Parameters<Fake['repo']['saveLines']>[0]);
  await history.repo.patchLine('a1', { copied_at: '2026-11-25T10:01:00Z' });
  await history.repo.patchLine('a2', { kept_at: '2026-11-25T10:02:00Z' });
  await history.repo.uploadScreenshot('user/shot.jpg', 'file:///shot.jpg');
  return { history, personId };
}

describe('PeopleScreen', () => {
  it('says so when there is nobody yet', async () => {
    await renderWithData(<PeopleScreen />);
    expect(await screen.findByTestId('no-people')).toBeOnTheScreen();
  });

  it('lists people, most recent first, with how the user knows them', async () => {
    const { history } = await seed();
    await history.repo.upsertPerson('newer.one', null, '2026-11-25T11:00:00Z');
    await renderWithData(<PeopleScreen />, { historyRepo: history.repo });

    expect(await screen.findByText('@newer.one')).toBeOnTheScreen();
    expect(screen.getByTestId('person-card-0')).toHaveTextContent(/@newer\.one/);
    expect(screen.getByTestId('person-card-1')).toHaveTextContent(/@some\.one/);
    expect(screen.getByTestId('person-card-1')).toHaveTextContent(/Mutual follow/);
    expect(screen.queryByTestId('no-people')).toBeNull();
  });

  it('opens a person when tapped', async () => {
    const { history, personId } = await seed();
    await renderWithData(<PeopleScreen />, { historyRepo: history.repo });
    const user = userEvent.setup();

    await user.press(await screen.findByTestId('person-card-0'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/people/[id]', params: { id: personId } });
  });

  it('shows the list saved on the phone when the server cannot be reached', async () => {
    const { history } = await seed();
    const peopleCache = createMemoryCache([...history.people]).cache;
    history.failNext();
    await renderWithData(<PeopleScreen />, { historyRepo: history.repo, peopleCache });

    expect(await screen.findByText('@some.one')).toBeOnTheScreen();
    expect(await screen.findByText(/Showing the copy saved on this phone/)).toBeOnTheScreen();
  });

  it('says how many changes are still waiting to be saved', async () => {
    const history = createFakeHistoryRepo();
    const waiting: QueuedEntry[] = [
      { entryId: 'q1', queuedAt: '2026-11-25T10:00:00Z', kind: 'linePatch', lineId: 'a1', patch: { kept_at: null } },
    ];
    history.failNext();
    await renderWithData(<PeopleScreen />, {
      historyRepo: history.repo,
      outboxCache: createMemoryCache(waiting).cache,
    });

    expect(await screen.findByTestId('history-waiting')).toHaveTextContent(/1 change is waiting to be saved/);
  });
});

describe('PersonScreen', () => {
  const open = async (history: Fake, personId: string) => {
    await renderWithData(<PersonScreen id={personId} />, { historyRepo: history.repo });
    await screen.findByTestId('timeline-item-0');
    return userEvent.setup();
  };

  it('shows each set, newest first, with which lines were used', async () => {
    const { history, personId } = await seed();
    await open(history, personId);

    expect(screen.getByRole('header', { name: '@some.one' })).toBeOnTheScreen();
    expect(screen.getByTestId('timeline-heading-0')).toHaveTextContent('Flirty · Story reply · Shorter');
    expect(screen.getByTestId('timeline-heading-1')).toHaveTextContent('Casual · Story reply');
    expect(screen.getByTestId('timeline-line-state-1-0')).toHaveTextContent('Copied');
    expect(screen.getByTestId('timeline-line-state-1-1')).toHaveTextContent('Not used · Kept');
    expect(screen.getByTestId('timeline-line-state-0-0')).toHaveTextContent('Not used');
    expect(screen.getAllByText('Noticed: A bowl of pho.')).toHaveLength(2);
  });

  it('shows the screenshot once for sets made from the same screenshot', async () => {
    const { history, personId } = await seed();
    await open(history, personId);

    const image = await screen.findByTestId('timeline-screenshot-1');
    expect(image.props.source).toEqual({ uri: 'https://signed.example/user/shot.jpg' });
    expect(screen.queryByTestId('timeline-screenshot-0')).toBeNull();
  });

  it('offers a result only for lines that were copied', async () => {
    const { history, personId } = await seed();
    await open(history, personId);

    expect(screen.getByTestId('replied-1-0')).toBeOnTheScreen();
    expect(screen.queryByTestId('replied-1-1')).toBeNull();
    expect(screen.queryByTestId('replied-0-0')).toBeNull();
  });

  it('saves Replied, changes it to No reply, and clears it when tapped again', async () => {
    const { history, personId } = await seed();
    const user = await open(history, personId);
    const saved = () => history.lines.find((line) => line.id === 'a1');

    await user.press(screen.getByTestId('replied-1-0'));
    expect(screen.getByTestId('replied-1-0')).toBeSelected();
    await waitFor(() => expect(saved()?.result).toBe('replied'));
    expect(saved()?.result_at).toEqual(expect.any(String));

    await user.press(screen.getByTestId('no-reply-1-0'));
    expect(screen.getByTestId('no-reply-1-0')).toBeSelected();
    expect(screen.getByTestId('replied-1-0')).not.toBeSelected();
    await waitFor(() => expect(saved()?.result).toBe('no_reply'));

    await user.press(screen.getByTestId('no-reply-1-0'));
    expect(screen.getByTestId('no-reply-1-0')).not.toBeSelected();
    await waitFor(() => expect(saved()?.result).toBeNull());
    expect(saved()?.result_at).toBeNull();
  });

  it('keeps the mark on screen when it cannot be saved yet', async () => {
    const { history, personId } = await seed();
    const user = await open(history, personId);

    history.failNext();
    await user.press(screen.getByTestId('replied-1-0'));

    expect(screen.getByTestId('replied-1-0')).toBeSelected();
    expect(screen.queryByTestId('timeline-error')).toBeNull();
  });

  it('changes how the user knows her', async () => {
    const { history, personId } = await seed();
    const user = await open(history, personId);
    expect(screen.getByTestId('person-context-mutual_follow')).toBeSelected();

    await user.press(screen.getByTestId('person-context-already_talking'));

    expect(screen.getByTestId('person-context-already_talking')).toBeSelected();
    await waitFor(() => expect(history.people[0].context).toBe('already_talking'));
  });

  it('says so when there is nothing saved for her', async () => {
    const history = createFakeHistoryRepo();
    const personId = await history.repo.upsertPerson('quiet.one', null, '2026-11-25T10:00:00Z');
    await renderWithData(<PersonScreen id={personId} />, { historyRepo: history.repo });

    expect(await screen.findByTestId('timeline-empty')).toBeOnTheScreen();
  });

  it('explains a failed load and loads on Try again', async () => {
    const { history, personId } = await seed();
    (history.repo.listInteractions as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderWithData(<PersonScreen id={personId} />, { historyRepo: history.repo });
    const user = userEvent.setup();

    expect(await screen.findByTestId('timeline-error')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('timeline-item-0')).toBeOnTheScreen();
    expect(screen.queryByTestId('timeline-error')).toBeNull();
  });

  it('says so when the person does not exist', async () => {
    await renderWithData(<PersonScreen id="nobody" />);
    expect(await screen.findByText('Person not found')).toBeOnTheScreen();
  });
});
