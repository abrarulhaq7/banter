import type { Session } from '@supabase/supabase-js';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AuthProvider, type AuthClient } from '@/auth';
import { ThemeProvider, type ThemeName } from '@/theme';

type ThemeOptions = {
  theme?: ThemeName;
  onThemeChange?: (name: ThemeName) => void;
};

/** Renders a component inside the theme provider, the way every screen is rendered. */
export function renderWithTheme(element: ReactElement, { theme, onThemeChange }: ThemeOptions = {}) {
  return render(
    <ThemeProvider initialTheme={theme} onThemeChange={onThemeChange}>
      {element}
    </ThemeProvider>,
  );
}

type AppOptions = ThemeOptions & {
  /** Null means "Supabase is not set up". */
  client: AuthClient | null;
  setupProblem?: string;
};

/** Renders a component inside the theme and auth providers, with a fake auth client. */
export function renderWithApp(element: ReactElement, { client, setupProblem, ...theme }: AppOptions) {
  return renderWithTheme(
    <AuthProvider client={client} setupProblem={setupProblem}>
      {element}
    </AuthProvider>,
    theme,
  );
}

export function fakeSession(email = 'sam@example.com'): Session {
  return {
    access_token: 'fake-access-token',
    refresh_token: 'fake-refresh-token',
    user: { id: '11111111-1111-4111-8111-111111111111', email },
  } as unknown as Session;
}

type Listener = (event: string, session: Session | null) => void;

/**
 * A stand-in for `supabase.auth`. Like the real client, it reports the saved session
 * shortly after something subscribes. `emit` plays a later sign-in or sign-out.
 */
export function createFakeAuthClient(savedSession: Session | null = null) {
  let listener: Listener | undefined;
  const unsubscribe = jest.fn();

  const client = {
    onAuthStateChange: jest.fn((callback: Listener) => {
      listener = callback;
      void Promise.resolve().then(() => callback('INITIAL_SESSION', savedSession));
      return { data: { subscription: { unsubscribe } } };
    }),
    signInWithPassword: jest.fn(async () => ({ data: {}, error: null })),
    signUp: jest.fn(async () => ({ data: { session: fakeSession() }, error: null })),
    signOut: jest.fn(async () => ({ error: null })),
    startAutoRefresh: jest.fn(async () => {}),
    stopAutoRefresh: jest.fn(async () => {}),
  };

  return {
    client: client as unknown as AuthClient,
    mocks: client,
    unsubscribe,
    emit: (session: Session | null) => listener?.(session ? 'SIGNED_IN' : 'SIGNED_OUT', session),
  };
}
