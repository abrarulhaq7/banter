import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { ProfileForm } from '@/components/profile-form';
import { createFakeProfileRepo, makeProfile, renderWithData } from '@/test-utils';

async function setup(profile = makeProfile()) {
  const fake = createFakeProfileRepo(profile);
  const onSaved = jest.fn();
  await renderWithData(<ProfileForm submitLabel="Continue" onSaved={onSaved} />, {
    profileRepo: fake.repo,
  });
  return { fake, onSaved, user: userEvent.setup() };
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByRole('button', { name: 'Continue' }));

describe('ProfileForm', () => {
  it('saves what was typed', async () => {
    const { fake, onSaved, user } = await setup();

    await user.type(screen.getByLabelText('Name'), 'Sam');
    await user.type(screen.getByLabelText('Age (optional)'), '27');
    await user.type(screen.getByLabelText('How you text (optional)'), 'short and dry');
    await submit(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(fake.repo.update).toHaveBeenCalledWith(expect.any(String), {
      display_name: 'Sam',
      age: 27,
      city: null,
      work: null,
      interests: null,
      texting_style: 'short and dry',
    });
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

  it('shows a failed save and stays on the form', async () => {
    const { fake, onSaved, user } = await setup();
    await user.type(screen.getByLabelText('Name'), 'Sam');
    fake.failNext();

    await submit(user);

    expect(await screen.findByTestId('profile-error')).toHaveTextContent(/No connection/);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
