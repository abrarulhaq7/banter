import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { PeopleScreen } from '@/components/people/people-screen';
import { PersonScreen } from '@/components/people/person-screen';
import { ShotScreen } from '@/components/people/shot-screen';
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

/**
 * One person with two screenshots. The older one has two sets (Casual, then Flirty ·
 * Shorter); the first Casual line was copied and the second kept. The newer one has one
 * Funny set that was not used.
 */
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
  await interaction('third', '2026-11-25T11:00:00Z', {
    tone_id: 'funny',
    tone_label: 'Funny',
    screenshot_path: 'user/other.jpg',
    noticed: 'A dog on a beach.',
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
    line('c1', 'third', 1, 'Funny one'),
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
    expect(screen.queryByTestId('people-search')).toBeNull();
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

  it('gets a search field once the list is long, and filters by username', async () => {
    const history = createFakeHistoryRepo();
    for (let index = 1; index <= 8; index++) {
      await history.repo.upsertPerson(`person.${index}`, null, `2026-11-25T10:0${index}:00Z`);
    }
    await history.repo.upsertPerson('the.odd_one', null, '2026-11-25T09:00:00Z');
    await renderWithData(<PeopleScreen />, { historyRepo: history.repo });
    const user = userEvent.setup();

    await user.type(await screen.findByTestId('people-search'), '@ODD');

    expect(screen.getByText('@the.odd_one')).toBeOnTheScreen();
    expect(screen.queryByText('@person.1')).toBeNull();

    await user.type(screen.getByTestId('people-search'), 'zzz');
    expect(screen.getByTestId('no-match')).toBeOnTheScreen();
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
    await screen.findByTestId('shot-row-0');
    return userEvent.setup();
  };

  it('shows one short row per screenshot, newest first, with the tones tried and how it went', async () => {
    const { history, personId } = await seed();
    await open(history, personId);

    expect(screen.getByTestId('person-title')).toHaveTextContent('@some.one');
    expect(screen.getByTestId('shot-row-0')).toHaveTextContent(/Funny/);
    expect(screen.getByTestId('shot-row-0')).toHaveTextContent(/Not used/);
    expect(screen.getByTestId('shot-row-1')).toHaveTextContent(/Casual, Flirty/);
    expect(screen.getByTestId('shot-row-1')).toHaveTextContent(/Sent/);
    expect(screen.queryByTestId('shot-row-2')).toBeNull();
    // The lines themselves are one tap deeper.
    expect(screen.queryByText('Casual one')).toBeNull();
  });

  it('opens a screenshot when its row is tapped', async () => {
    const { history, personId } = await seed();
    const user = await open(history, personId);

    await user.press(screen.getByTestId('shot-row-1'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/people/[id]/[shot]', params: { id: personId, shot: 'first' } });
  });

  it('changes how the user knows her, in a sheet', async () => {
    const { history, personId } = await seed();
    const user = await open(history, personId);
    expect(screen.getByTestId('person-context-row')).toHaveTextContent(/Mutual follow/);
    expect(screen.queryByTestId('person-context-already_talking')).toBeNull();

    await user.press(screen.getByTestId('person-context-row'));
    expect(screen.getByTestId('person-context-mutual_follow')).toBeSelected();
    await user.press(screen.getByTestId('person-context-already_talking'));

    expect(screen.queryByTestId('person-context-sheet')).toBeNull();
    expect(screen.getByTestId('person-context-row')).toHaveTextContent(/Already talking/);
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

    expect(await screen.findByTestId('shot-row-0')).toBeOnTheScreen();
    expect(screen.queryByTestId('timeline-error')).toBeNull();
  });

  it('says so when the person does not exist', async () => {
    await renderWithData(<PersonScreen id="nobody" />);
    expect(await screen.findByText('Person not found')).toBeOnTheScreen();
  });
});

describe('ShotScreen', () => {
  const open = async (history: Fake, personId: string, shotId = 'first') => {
    await renderWithData(<ShotScreen personId={personId} shotId={shotId} />, { historyRepo: history.repo });
    await screen.findByTestId('shot-heading');
    return userEvent.setup();
  };

  it('shows the screenshot and its newest set, with the other sets behind chips', async () => {
    const { history, personId } = await seed();
    const user = await open(history, personId);

    // The screenshot is a thumbnail, so the lines are what the screen shows. A tap opens it large.
    const image = await screen.findByTestId('shot-screenshot-image');
    expect(image.props.source).toEqual({ uri: 'https://signed.example/user/shot.jpg' });
    expect(screen.queryByTestId('shot-screenshot-large')).toBeNull();
    await user.press(screen.getByTestId('shot-screenshot'));
    expect(screen.getByTestId('shot-screenshot-large').props.source).toEqual({ uri: 'https://signed.example/user/shot.jpg' });
    await user.press(screen.getByTestId('sheet-close'));
    expect(screen.getByTestId('shot-title')).toHaveTextContent('@some.one');
    expect(screen.getByTestId('shot-status')).toHaveTextContent('Sent');
    expect(screen.getByTestId('shot-heading')).toHaveTextContent('Flirty · Story reply · Shorter');
    expect(screen.getByText('Flirty one')).toBeOnTheScreen();
    expect(screen.queryByText('Casual one')).toBeNull();
    // Lines from another screenshot are not here.
    expect(screen.queryByText('Funny one')).toBeNull();

    await user.press(screen.getByTestId('shot-set-chip-1'));

    expect(screen.getByTestId('shot-heading')).toHaveTextContent('Casual · Story reply');
    expect(screen.getByTestId('shot-line-state-0')).toHaveTextContent('Copied');
    expect(screen.getByTestId('shot-line-state-1')).toHaveTextContent('Not used · Kept');
  });

  it('finds the screenshot from any of its sets', async () => {
    const { history, personId } = await seed();
    await open(history, personId, 'second');
    expect(screen.getByTestId('shot-set-chip-1')).toHaveTextContent('Casual');
  });

  it('offers a result only for lines that were copied', async () => {
    const { history, personId } = await seed();
    const user = await open(history, personId);
    expect(screen.queryByTestId('replied-0')).toBeNull();

    await user.press(screen.getByTestId('shot-set-chip-1'));

    expect(screen.getByTestId('replied-0')).toBeOnTheScreen();
    expect(screen.queryByTestId('replied-1')).toBeNull();
  });

  it('saves She replied, changes it to No reply, and clears it when tapped again', async () => {
    const { history, personId } = await seed();
    const user = await open(history, personId);
    await user.press(screen.getByTestId('shot-set-chip-1'));
    const saved = () => history.lines.find((line) => line.id === 'a1');

    await user.press(screen.getByTestId('replied-0'));
    expect(screen.getByTestId('replied-0')).toBeSelected();
    expect(screen.getByTestId('shot-status')).toHaveTextContent('She replied');
    await waitFor(() => expect(saved()?.result).toBe('replied'));
    expect(saved()?.result_at).toEqual(expect.any(String));

    await user.press(screen.getByTestId('no-reply-0'));
    expect(screen.getByTestId('no-reply-0')).toBeSelected();
    expect(screen.getByTestId('replied-0')).not.toBeSelected();
    await waitFor(() => expect(saved()?.result).toBe('no_reply'));

    await user.press(screen.getByTestId('no-reply-0'));
    expect(screen.getByTestId('no-reply-0')).not.toBeSelected();
    await waitFor(() => expect(saved()?.result).toBeNull());
    expect(saved()?.result_at).toBeNull();
  });

  it('keeps the mark on screen when it cannot be saved yet', async () => {
    const { history, personId } = await seed();
    const user = await open(history, personId);
    await user.press(screen.getByTestId('shot-set-chip-1'));

    history.failNext();
    await user.press(screen.getByTestId('replied-0'));

    expect(screen.getByTestId('replied-0')).toBeSelected();
    expect(screen.queryByTestId('timeline-error')).toBeNull();
  });

  it('says so when the screenshot is not in her history', async () => {
    const { history, personId } = await seed();
    await renderWithData(<ShotScreen personId={personId} shotId="gone" />, { historyRepo: history.repo });
    expect(await screen.findByTestId('shot-missing')).toBeOnTheScreen();
  });
});
