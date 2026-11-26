import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getSupabaseConfig } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';

import { authErrorMessage } from './auth-errors';

/** The parts of the Supabase auth client the app uses. Tests pass a fake. */
export type AuthClient = Pick<
  SupabaseClient['auth'],
  | 'onAuthStateChange'
  | 'signInWithPassword'
  | 'signUp'
  | 'signOut'
  | 'startAutoRefresh'
  | 'stopAutoRefresh'
>;

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; message: string };

type AuthContextValue = {
  /** 'loading' until the saved session has been read from the phone. */
  status: AuthStatus;
  session: Session | null;
  /** Why Supabase cannot be reached from this build, or null when it is set up. */
  setupProblem: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
  /** Defaults to the app's Supabase client. Null means Supabase is not set up. */
  client?: AuthClient | null;
  /** Shown when `client` is null. Defaults to the reason from the environment check. */
  setupProblem?: string;
};

function defaultSetupProblem(): string {
  const config = getSupabaseConfig();
  return config.ok ? 'Supabase is not connected.' : config.problem;
}

export function AuthProvider({ children, client, setupProblem }: AuthProviderProps) {
  const auth = client === undefined ? (getSupabase()?.auth ?? null) : client;
  const problem = auth ? null : (setupProblem ?? defaultSetupProblem());

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!auth) return;

    // Fires once with the saved session (or null), then again on every sign-in,
    // sign-out and token refresh.
    const { data } = auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!auth) return;

    // The client starts refreshing the session by itself. Pause that while the app is in
    // the background and resume when it comes back.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void auth.startAutoRefresh();
      else void auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, [auth]);

  const notConnected: AuthResult = { ok: false, message: problem ?? '' };

  const value: AuthContextValue = {
    status: !auth ? 'signedOut' : !ready ? 'loading' : session ? 'signedIn' : 'signedOut',
    session,
    setupProblem: problem,

    async signIn(email, password) {
      if (!auth) return notConnected;
      try {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
      } catch (error) {
        return { ok: false, message: authErrorMessage(error as Error) };
      }
    },

    async signUp(email, password) {
      if (!auth) return notConnected;
      try {
        const { data, error } = await auth.signUp({ email: email.trim(), password });
        if (error) return { ok: false, message: authErrorMessage(error) };
        // With "Confirm email" turned on, Supabase creates the account without a session.
        return { ok: true, needsEmailConfirmation: !data.session };
      } catch (error) {
        return { ok: false, message: authErrorMessage(error as Error) };
      }
    },

    async signOut() {
      if (!auth) return notConnected;
      try {
        // 'local' ends the session on this phone only, and works without internet.
        const { error } = await auth.signOut({ scope: 'local' });
        return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
      } catch (error) {
        return { ok: false, message: authErrorMessage(error as Error) };
      }
    },
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}
