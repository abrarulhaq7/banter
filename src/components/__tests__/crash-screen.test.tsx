import { render, screen, userEvent } from '@testing-library/react-native';

import { CrashScreen } from '@/components/crash-screen';

describe('CrashScreen', () => {
  it('explains the problem in plain words, with no providers around it', async () => {
    await render(<CrashScreen error={new Error('boom')} retry={jest.fn()} />);

    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(screen.getByText(/Your account, keys and history are safe/)).toBeOnTheScreen();
  });

  it('lets the user try the screen again', async () => {
    const retry = jest.fn(async () => {});
    await render(<CrashScreen error={new Error('boom')} retry={retry} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows the technical detail to the developer only', async () => {
    await render(<CrashScreen error={new TypeError('x is undefined')} retry={jest.fn()} />);
    // Tests run as a development build.
    expect(screen.getByTestId('crash-detail')).toHaveTextContent('TypeError: x is undefined');
  });
});
