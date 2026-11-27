import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { DataScreen } from '@/components/settings/data-screen';
import { ThemeScreen } from '@/components/settings/theme-screen';
import { UsageScreen } from '@/components/settings/usage-screen';
import type { QueuedEntry } from '@/history';
import {
  createFakeHistoryRepo,
  createFakeProfileRepo,
  createMemoryCache,
  makeProfile,
  renderWithData,
} from '@/test-utils';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockSignOut = jest.fn(async () => ({ ok: true as const }));
jest.mock('@/hooks/use-sign-out', () => ({
  useSignOut: () => mockSignOut,
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockSignOut.mockClear();
});

type Fake = ReturnType<typeof createFakeHistoryRepo>;

/** One person, with `count` generations made with the given key and model. */
async function generations(history: Fake, count: number, key = 'Main', model = 'gemini-3.5-flash-lite', provider = 'gemini') {
  const personId = await history.repo.upsertPerson('some.one', null, '2026-11-25T10:00:00Z');
  for (let n = 0; n < count; n += 1) {
    const id = `${key}-${model}-${n}`;
    await history.repo.saveInteraction({
      id,
      person_id: personId,
      mode_id: 'story_reply',
      tone_id: 'casual',
      tone_label: 'Casual',
      provider,
      model,
      api_key_label: key,
      screenshot_path: `user/${id}.jpg`,
      created_at: `2026-11-25T10:0${n}:00Z`,
    } as Parameters<Fake['repo']['saveInteraction']>[0]);
    await history.repo.saveLines([{ id: `${id}-l1`, interaction_id: id, position: 1, text: 'One', hook: null }]);
    await history.repo.uploadScreenshot(`user/${id}.jpg`, 'file:///shot.jpg');
  }
  return history;
}

describe('DataScreen', () => {
  async function setup({ settings = {} as Record<string, unknown>, history = createFakeHistoryRepo() } = {}) {
    const profile = createFakeProfileRepo(makeProfile({ display_name: 'Sam', settings }));
    const outbox = createMemoryCache<QueuedEntry[]>();
    await renderWithData(<DataScreen />, {
      profileRepo: profile.repo,
      historyRepo: history.repo,
      outboxCache: outbox.cache,
    });
    await waitFor(() => expect(profile.repo.get).toHaveBeenCalled());
    await waitFor(() => expect(history.repo.listPeople).toHaveBeenCalled());
    return { profile, history, outbox, user: userEvent.setup() };
  }

  it('is a short menu: screenshots, usage, and the two deletions', async () => {
    const { user } = await setup();

    expect(await screen.findByTestId('save-screenshots')).toHaveTextContent(/On/);
    expect(screen.getByTestId('delete-history')).toHaveTextContent(/Your keys and tones stay/);
    expect(screen.getByTestId('delete-account')).toHaveTextContent(/including your login/);

    await user.press(screen.getByTestId('open-usage'));
    expect(mockPush).toHaveBeenCalledWith('/usage');
  });

  it('turns saving screenshots off and on, keeping other settings', async () => {
    const { profile, user } = await setup({ settings: { something_else: 1 } });
    await screen.findByTestId('save-screenshots');

    await user.press(screen.getByTestId('save-screenshots'));
    await waitFor(() =>
      expect(profile.repo.update).toHaveBeenCalledWith(expect.any(String), {
        settings: { something_else: 1, save_screenshots: false },
      }),
    );
    await waitFor(() => expect(screen.getByTestId('save-screenshots')).toHaveTextContent(/Off/));

    await user.press(screen.getByTestId('save-screenshots'));
    await waitFor(() =>
      expect(profile.repo.update).toHaveBeenLastCalledWith(expect.any(String), {
        settings: { something_else: 1, save_screenshots: true },
      }),
    );
  });

  it('shows Off when saving was turned off earlier', async () => {
    await setup({ settings: { save_screenshots: false } });

    await waitFor(() => expect(screen.getByTestId('save-screenshots')).toHaveTextContent(/Off\. New lines are saved without the picture/));
  });

  it('says why when the setting cannot be saved', async () => {
    const { profile, user } = await setup();
    await screen.findByTestId('save-screenshots');
    profile.failNext();

    await user.press(screen.getByTestId('save-screenshots'));

    expect(await screen.findByTestId('data-error')).toHaveTextContent(/No connection/);
    expect(screen.getByTestId('save-screenshots')).toHaveTextContent(/On/);
  });

  it('asks before deleting all history, and does nothing on Cancel', async () => {
    const { history, user } = await setup({ history: await generations(createFakeHistoryRepo(), 2) });

    await user.press(screen.getByTestId('delete-history'));
    expect(screen.getByText('Delete all history?')).toBeOnTheScreen();
    await user.press(screen.getByTestId('dialog-cancel'));

    expect(history.repo.deleteAllHistory).not.toHaveBeenCalled();
    expect(history.interactions).toHaveLength(2);
  });

  it('deletes people, lines and screenshots, and anything still waiting to be sent', async () => {
    const { history, outbox, user } = await setup({ history: await generations(createFakeHistoryRepo(), 2) });
    await outbox.cache.write([{ kind: 'linePatch', lineId: 'x', patch: {}, entryId: 'e1', queuedAt: 'now' }]);

    await user.press(screen.getByTestId('delete-history'));
    await user.press(screen.getByTestId('dialog-confirm'));

    await waitFor(() => expect(history.repo.deleteAllHistory).toHaveBeenCalledTimes(1));
    expect(history.people).toHaveLength(0);
    expect(history.interactions).toHaveLength(0);
    expect(history.lines).toHaveLength(0);
    expect(history.files.size).toBe(0);
    expect(outbox.current()).toEqual([]);
    await waitFor(() => expect(screen.queryByText('Delete all history?')).toBeNull());
    // The account is untouched.
    expect(history.repo.deleteAccount).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('keeps everything and says why when history cannot be deleted', async () => {
    const { history, user } = await setup({ history: await generations(createFakeHistoryRepo(), 1) });
    history.failNext();

    await user.press(screen.getByTestId('delete-history'));
    await user.press(screen.getByTestId('dialog-confirm'));

    expect(await screen.findByTestId('data-error')).toHaveTextContent(/No connection/);
    expect(history.interactions).toHaveLength(1);
  });

  it('asks before deleting the account, in its own words', async () => {
    const { history, user } = await setup();

    await user.press(screen.getByTestId('delete-account'));
    expect(screen.getByText('Delete your account?')).toBeOnTheScreen();
    expect(screen.getByText(/You cannot sign in again with this account/)).toBeOnTheScreen();
    await user.press(screen.getByTestId('dialog-cancel'));

    expect(history.repo.deleteAccount).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('deletes the account, then signs out of this phone', async () => {
    const { history, user } = await setup({ history: await generations(createFakeHistoryRepo(), 1) });

    await user.press(screen.getByTestId('delete-account'));
    await user.press(screen.getByTestId('dialog-confirm'));

    await waitFor(() => expect(history.repo.deleteAccount).toHaveBeenCalledWith(expect.any(String)));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(history.files.size).toBe(0);
  });

  it('does not sign out when the account could not be deleted', async () => {
    const { history, user } = await setup();
    history.failNext();

    await user.press(screen.getByTestId('delete-account'));
    await user.press(screen.getByTestId('dialog-confirm'));

    expect(await screen.findByTestId('data-error')).toHaveTextContent(/No connection/);
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe('UsageScreen', () => {
  async function setup(history: Fake) {
    await renderWithData(<UsageScreen />, { historyRepo: history.repo });
    await waitFor(() => expect(history.repo.usage).toHaveBeenCalled());
    return { history, user: userEvent.setup() };
  }

  it('says so when nothing has been counted yet', async () => {
    await setup(createFakeHistoryRepo());

    expect(await screen.findByTestId('usage-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('usage-total')).toBeNull();
  });

  it('shows the total and one row per key and model, most used first', async () => {
    const history = createFakeHistoryRepo();
    await generations(history, 1, 'Backup', 'gpt-6-luna', 'openai');
    await generations(history, 3, 'Main');
    await setup(history);

    expect(await screen.findByTestId('usage-total-number')).toHaveTextContent('4');
    expect(screen.getByTestId('usage-row-0')).toHaveTextContent(/Main/);
    // The model's name, not its id, when the model list knows it.
    expect(screen.getByTestId('usage-row-0')).toHaveTextContent(/Gemini · Gemini 3\.5 Flash-Lite/);
    expect(screen.getByTestId('usage-row-0')).toHaveTextContent(/3/);
    expect(screen.getByTestId('usage-row-1')).toHaveTextContent(/Backup/);
    expect(screen.getByTestId('usage-row-1')).toHaveTextContent(/OpenAI · GPT-6 Luna/);
  });

  it('switches between this month and all time', async () => {
    const history = await generations(createFakeHistoryRepo(), 2);
    history.repo.usage = jest.fn(async () => [
      { provider: 'gemini' as const, model: 'm-old', key_label: 'Old', generations: 5, this_month: 0, last_used_at: null },
      { provider: 'gemini' as const, model: 'm-new', key_label: null, generations: 3, this_month: 2, last_used_at: null },
    ]);
    const { user } = await setup(history);

    expect(await screen.findByTestId('usage-total-number')).toHaveTextContent('2');
    expect(screen.getByText(/generations this month/)).toBeOnTheScreen();
    // A key not used this month is left out; a key with no name still gets a row.
    expect(screen.getByTestId('usage-row-0')).toHaveTextContent(/Unnamed key/);
    expect(screen.queryByTestId('usage-row-1')).toBeNull();

    await user.press(screen.getByRole('button', { name: 'All time' }));

    expect(screen.getByTestId('usage-total-number')).toHaveTextContent('8');
    expect(screen.getByTestId('usage-row-0')).toHaveTextContent(/Old/);
    expect(screen.getByTestId('usage-row-0')).toHaveTextContent(/Gemini · m-old/);
  });

  it('says so when there is history but none this month', async () => {
    const history = createFakeHistoryRepo();
    history.repo.usage = jest.fn(async () => [
      { provider: 'gemini' as const, model: 'm', key_label: 'Old', generations: 5, this_month: 0, last_used_at: null },
    ]);
    await setup(history);

    expect(await screen.findByTestId('usage-none-this-month')).toBeOnTheScreen();
    expect(screen.getByTestId('usage-total-number')).toHaveTextContent('0');
  });

  it('explains a failed load and loads on Try again', async () => {
    const history = await generations(createFakeHistoryRepo(), 1);
    let calls = 0;
    const real = history.repo.usage;
    history.repo.usage = jest.fn(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('Network request failed');
      return real();
    });
    const { user } = await setup(history);

    expect(await screen.findByTestId('usage-error')).toHaveTextContent(/No connection/);
    await user.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('usage-total-number')).toHaveTextContent('1');
  });
});

describe('ThemeScreen', () => {
  it('saves the picked theme to the profile, so it follows the user', async () => {
    const profile = createFakeProfileRepo(makeProfile());
    const onThemeChange = jest.fn();
    await renderWithData(<ThemeScreen />, { profileRepo: profile.repo, onThemeChange });
    await waitFor(() => expect(profile.repo.get).toHaveBeenCalled());

    await userEvent.setup().press(screen.getByRole('button', { name: 'Ember theme' }));

    await waitFor(() => expect(profile.repo.update).toHaveBeenCalledWith(expect.any(String), { theme: 'ember' }));
    // And on the phone, through the theme provider.
    expect(onThemeChange).toHaveBeenCalledWith('ember');
    expect(screen.queryByTestId('theme-not-saved')).toBeNull();
  });

  it('does not save when the theme already in use is tapped', async () => {
    const profile = createFakeProfileRepo(makeProfile());
    await renderWithData(<ThemeScreen />, { profileRepo: profile.repo });
    await waitFor(() => expect(profile.repo.get).toHaveBeenCalled());

    await userEvent.setup().press(screen.getByRole('button', { name: 'Midnight Plum theme' }));

    expect(profile.repo.update).not.toHaveBeenCalled();
  });

  it('keeps the new colours and says they are on this phone only when saving fails', async () => {
    const profile = createFakeProfileRepo(makeProfile());
    await renderWithData(<ThemeScreen />, { profileRepo: profile.repo });
    await waitFor(() => expect(profile.repo.get).toHaveBeenCalled());
    profile.failNext();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Deep Sea theme' }));

    expect(await screen.findByTestId('theme-not-saved')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Deep Sea theme' })).toBeSelected();
  });
});
