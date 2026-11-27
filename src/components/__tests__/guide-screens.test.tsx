import { screen, userEvent, within } from '@testing-library/react-native';

import { GUIDE_SETUPS, GUIDE_TOPICS } from '@/components/guide/guide-content';
import { GuideEntryScreen } from '@/components/guide/guide-entry-screen';
import { GuideScreen } from '@/components/guide/guide-screen';
import { DEFAULT_TONES } from '@/engine';
import { CONTEXT_LABELS } from '@/history/labels';
import { DIRECTION_LABEL } from '@/generate/session';
import { renderWithTheme } from '@/test-utils';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
});

describe('GuideScreen', () => {
  it('lists the best setups first, each with its options, then what each option does', async () => {
    await renderWithTheme(<GuideScreen />);

    expect(screen.getByTestId('guide-setup-story-stranger')).toHaveTextContent(/Her story, you're strangers/);
    expect(screen.getByTestId('guide-setup-story-stranger')).toHaveTextContent(/Story reply · Flirty · Stranger/);
    expect(screen.getByTestId('guide-setup-heat')).toHaveTextContent(
      /Reply · Spicy · Already talking · Turn up the heat/,
    );
    for (const topic of GUIDE_TOPICS) expect(screen.getByTestId(`guide-topic-${topic.id}`)).toBeOnTheScreen();
  });

  it('opens a setup or a kind of option on its own page', async () => {
    const user = userEvent.setup();
    await renderWithTheme(<GuideScreen />);

    await user.press(screen.getByTestId('guide-setup-ask-out'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/guide/[id]', params: { id: 'ask-out' } });

    await user.press(screen.getByTestId('guide-topic-tones'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/guide/[id]', params: { id: 'tones' } });

    await user.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('GuideEntryScreen', () => {
  it('shows a setup: the options to pick, why it works, and an example', async () => {
    await renderWithTheme(<GuideEntryScreen id="story-stranger" />);

    expect(screen.getByTestId('guide-title')).toHaveTextContent("Her story, you're strangers");
    const choose = screen.getByTestId('guide-choose');
    for (const option of ['Story reply', 'Flirty', 'Stranger'])
      expect(within(choose).getByText(option)).toBeOnTheScreen();
    expect(screen.getByTestId('guide-also')).toHaveTextContent('Also works: Funny or Teasing');
    expect(screen.getByTestId('guide-why')).toHaveTextContent(/wit and curiosity win, never her looks/);
    expect(screen.getByTestId('guide-example-line')).toHaveTextContent(
      '"you rate every café out of ten and keep the scores to yourself"',
    );
  });

  it('shows a kind of option: each choice with what it does', async () => {
    await renderWithTheme(<GuideEntryScreen id="how-you-know-her" />);

    expect(screen.getByTestId('guide-title')).toHaveTextContent('How you know her');
    expect(screen.getByTestId('guide-item-Stranger')).toHaveTextContent(/Nothing about her looks/);
    expect(screen.getByTestId('guide-item-Know her')).toHaveTextContent(/Compliments on her looks are fine/);
    expect(screen.getByTestId('guide-note')).toHaveTextContent(/Not set counts as a stranger/);
  });

  it('says so when a page is not there, and goes back', async () => {
    const user = userEvent.setup();
    await renderWithTheme(<GuideEntryScreen id="no-such-page" />);

    expect(screen.getByText('Not found')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('guide content', () => {
  // The guide names options as they read on Generate, so a reader can find them there.
  const onGenerate = new Set([
    'Story reply',
    'Opener',
    'Reply',
    'Analyse',
    'Roman Urdu',
    ...Object.values(DEFAULT_TONES).map((tone) => tone.label),
    ...Object.values(CONTEXT_LABELS),
    ...Object.values(DIRECTION_LABEL),
  ]);

  it('only names options that exist on Generate', () => {
    for (const setup of GUIDE_SETUPS) {
      for (const option of setup.choose) expect(onGenerate.has(option) ? option : `unknown: ${option}`).toBe(option);
    }
  });

  it('explains every tone Banter has', () => {
    const tones = GUIDE_TOPICS.find((topic) => topic.id === 'tones')!;
    expect(tones.items.map((item) => item.name)).toEqual(Object.values(DEFAULT_TONES).map((tone) => tone.label));
  });

  it('gives every page its own id', () => {
    const ids = [...GUIDE_SETUPS, ...GUIDE_TOPICS].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
