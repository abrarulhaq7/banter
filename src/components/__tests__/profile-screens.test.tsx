import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { FACT_FIELDS, VOICE_FIELDS } from '@/components/profile/profile-fields';
import { ProfileScreen } from '@/components/profile/profile-screen';
import { ProfileStepScreen } from '@/components/profile/profile-step-screen';
import { createFakeProfileRepo, makeProfile, renderWithData } from '@/test-utils';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

beforeEach(() => mockBack.mockClear());

describe('ProfileStepScreen', () => {
  async function setup(fields = FACT_FIELDS, profile = makeProfile()) {
    const fake = createFakeProfileRepo(profile);
    const onSaved = jest.fn();
    await renderWithData(
      <ProfileStepScreen testID="step" title="About you" fields={fields} submitLabel="Continue" onSaved={onSaved} />,
      { profileRepo: fake.repo },
    );
    return { fake, onSaved, user: userEvent.setup() };
  }

  const submit = (user: ReturnType<typeof userEvent.setup>) =>
    user.press(screen.getByRole('button', { name: 'Continue' }));

  it('asks only for the fields of its step', async () => {
    await setup();

    expect(screen.getByLabelText('Name')).toBeOnTheScreen();
    expect(screen.getByLabelText('Work or study (optional)')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Interests (optional)')).toBeNull();
    expect(screen.queryByLabelText('How you text (optional)')).toBeNull();
  });

  it('saves what was typed', async () => {
    const { fake, onSaved, user } = await setup();

    await user.type(screen.getByLabelText('Name'), 'Sam');
    await user.type(screen.getByLabelText('Age (optional)'), '27');
    await submit(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(fake.repo.update).toHaveBeenCalledWith(expect.any(String), {
      display_name: 'Sam',
      age: 27,
      city: null,
      work: null,
      interests: null,
      texting_style: null,
    });
  });

  it('keeps what an earlier step saved', async () => {
    const { fake, onSaved, user } = await setup(
      VOICE_FIELDS,
      makeProfile({ display_name: 'Sam', age: 27, city: 'Lahore' }),
    );

    await user.type(screen.getByLabelText('How you text (optional)'), 'short and dry');
    await submit(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(fake.repo.update).toHaveBeenCalledWith(expect.any(String), {
      display_name: 'Sam',
      age: 27,
      city: 'Lahore',
      work: null,
      interests: null,
      texting_style: 'short and dry',
    });
  });

  it('lets the optional step through with nothing typed', async () => {
    const { onSaved, user } = await setup(VOICE_FIELDS, makeProfile({ display_name: 'Sam' }));

    await submit(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('needs a name', async () => {
    const { fake, onSaved, user } = await setup();

    await submit(user);

    expect(screen.getByText('Enter your name.')).toBeOnTheScreen();
    expect(fake.repo.update).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not accept anyone under 18', async () => {
    const { fake, user } = await setup();

    await user.type(screen.getByLabelText('Name'), 'Sam');
    await user.type(screen.getByLabelText('Age (optional)'), '16');
    await submit(user);

    expect(screen.getByText('Banter is for adults. You must be 18 or older.')).toBeOnTheScreen();
    expect(fake.repo.update).not.toHaveBeenCalled();
  });

  it('shows a failed save and stays on the step', async () => {
    const { fake, onSaved, user } = await setup();
    await user.type(screen.getByLabelText('Name'), 'Sam');
    fake.failNext();

    await submit(user);

    expect(await screen.findByTestId('profile-error')).toHaveTextContent(/No connection/);
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('ProfileScreen', () => {
  async function setup(profile = makeProfile({ display_name: 'Sam', age: 27, city: 'Lahore' })) {
    const fake = createFakeProfileRepo(profile);
    await renderWithData(<ProfileScreen />, { profileRepo: fake.repo });
    await waitFor(() => expect(screen.getByTestId('profile-row-name')).toHaveTextContent(/Sam/));
    return { fake, user: userEvent.setup() };
  }

  it('shows one row per fact with what is saved, and no form until a row is tapped', async () => {
    await setup();

    expect(screen.getByTestId('profile-row-age')).toHaveTextContent(/27/);
    expect(screen.getByTestId('profile-row-city')).toHaveTextContent(/Lahore/);
    expect(screen.getByTestId('profile-row-work')).toHaveTextContent(/Not set/);
    expect(screen.getByTestId('profile-row-textingStyle')).toHaveTextContent(/Not set/);
    expect(screen.queryByTestId('profile-save')).toBeNull();
  });

  it('changes one fact in a sheet and keeps the others', async () => {
    const { fake, user } = await setup();

    await user.press(screen.getByTestId('profile-row-textingStyle'));
    await user.type(screen.getByLabelText('How you text (optional)'), 'short and dry');
    await user.press(screen.getByTestId('profile-save'));

    await waitFor(() =>
      expect(fake.repo.update).toHaveBeenCalledWith(expect.any(String), {
        display_name: 'Sam',
        age: 27,
        city: 'Lahore',
        work: null,
        interests: null,
        texting_style: 'short and dry',
      }),
    );
    await waitFor(() => expect(screen.queryByTestId('profile-save')).toBeNull());
    expect(screen.getByTestId('profile-row-textingStyle')).toHaveTextContent(/short and dry/);
  });

  it('opens the sheet with the saved value', async () => {
    const { user } = await setup();

    await user.press(screen.getByTestId('profile-row-city'));

    expect(screen.getByTestId('profile-city')).toHaveDisplayValue('Lahore');
  });

  it('does not save an empty name or an age under 18', async () => {
    const { fake, user } = await setup();

    await user.press(screen.getByTestId('profile-row-name'));
    await user.clear(screen.getByTestId('profile-name'));
    await user.press(screen.getByTestId('profile-save'));
    expect(screen.getByText('Enter your name.')).toBeOnTheScreen();
    await user.press(screen.getByTestId('profile-cancel'));

    await user.press(screen.getByTestId('profile-row-age'));
    await user.clear(screen.getByTestId('profile-age'));
    await user.type(screen.getByTestId('profile-age'), '16');
    await user.press(screen.getByTestId('profile-save'));
    expect(screen.getByText('Banter is for adults. You must be 18 or older.')).toBeOnTheScreen();

    expect(fake.repo.update).not.toHaveBeenCalled();
  });

  it('clears an optional fact when it is saved empty', async () => {
    const { fake, user } = await setup();

    await user.press(screen.getByTestId('profile-row-city'));
    await user.clear(screen.getByTestId('profile-city'));
    await user.press(screen.getByTestId('profile-save'));

    await waitFor(() =>
      expect(fake.repo.update).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ city: null })),
    );
    await waitFor(() => expect(screen.getByTestId('profile-row-city')).toHaveTextContent(/Not set/));
  });

  it('keeps the sheet open and says why when the save fails', async () => {
    const { fake, user } = await setup();

    await user.press(screen.getByTestId('profile-row-work'));
    await user.type(screen.getByTestId('profile-work'), 'Designer');
    fake.failNext();
    await user.press(screen.getByTestId('profile-save'));

    expect(await screen.findByText(/No connection/)).toBeOnTheScreen();
    expect(screen.getByTestId('profile-save')).toBeOnTheScreen();
  });

  it('goes back from the header', async () => {
    const { user } = await setup();

    await user.press(screen.getByTestId('back-button'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
