import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { MIN_PASSWORD_LENGTH, useAuth, validateEmail, validatePassword } from '@/auth';
import { AppText, Banner, Button, Screen, SegmentedControl, TextField } from '@/components/ui';
import { radius, spacing } from '@/theme';

import LOGO from '../../assets/images/icon.png';

export type AuthMode = 'signIn' | 'signUp';

type AuthFormProps = {
  /** Which form shows first. The user switches between the two on the same screen. */
  initialMode?: AuthMode;
};

const MODES: { value: AuthMode; label: string }[] = [
  { value: 'signIn', label: 'Sign in' },
  { value: 'signUp', label: 'Sign up' },
];

const COPY = {
  signIn: { subtitle: 'Sign in to continue.', submit: 'Sign in' },
  signUp: { subtitle: 'Create your account.', submit: 'Create account' },
} as const;

/**
 * Sign in and sign up on one screen: the logo, a switch between the two, and the form,
 * in the middle of the screen. The two forms differ only in wording and password rules.
 */
export function AuthForm({ initialMode = 'signIn' }: AuthFormProps) {
  const { signIn, signUp, setupProblem } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const copy = COPY[mode];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password, mode);

  /** What was typed stays; what was said about the other form goes. */
  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    setShowFieldErrors(false);
    setFormError(null);
    setNotice(null);
  };

  const submit = async () => {
    setFormError(null);
    setNotice(null);
    setShowFieldErrors(true);
    if (emailError || passwordError) return;

    setBusy(true);
    const result = mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);

    if (!result.ok) {
      setFormError(result.message);
    } else if (result.needsEmailConfirmation) {
      setNotice('Account created. Confirm your email with the link we sent, then sign in.');
    }
    // On success the root layout sees the new session and shows the app.
  };

  return (
    <Screen
      testID={mode === 'signIn' ? 'sign-in-screen' : 'sign-up-screen'}
      fill
      contentStyle={styles.centered}>
      <View style={styles.form}>
        <View style={styles.brand}>
          <Image testID="auth-logo" source={LOGO} style={styles.logo} accessible={false} />
          <AppText variant="display" accessibilityRole="header">
            Banter
          </AppText>
          <AppText color="textMuted">{copy.subtitle}</AppText>
        </View>

        <SegmentedControl testIDPrefix="auth-mode" options={MODES} value={mode} onChange={switchMode} disabled={busy} />

        {setupProblem ? (
          <Banner testID="setup-problem" tone="warning" title="Setup needed">
            {setupProblem}
          </Banner>
        ) : null}

        <TextField
          testID="email-input"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          error={showFieldErrors ? emailError : undefined}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType={mode === 'signIn' ? 'username' : 'emailAddress'}
          returnKeyType="next"
        />
        <TextField
          testID="password-input"
          label="Password"
          // The rule sits inside the empty field: a line under it would read like an error
          // before anything was typed. A password that is too short is explained on Create.
          placeholder={mode === 'signUp' ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Password'}
          value={password}
          onChangeText={setPassword}
          error={showFieldErrors ? passwordError : undefined}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          // On sign-up, iOS's "strong password" suggestion covers the field and drops typed
          // characters, so password autofill is offered only when signing in.
          autoComplete={mode === 'signIn' ? 'current-password' : 'off'}
          textContentType={mode === 'signIn' ? 'password' : 'none'}
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        {formError ? (
          <Banner tone="danger" messageTestID="form-error">
            {formError}
          </Banner>
        ) : null}
        {notice ? (
          <Banner tone="success" messageTestID="form-notice">
            {notice}
          </Banner>
        ) : null}

        <Button testID="submit-button" label={copy.submit} onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The form sits in the middle of the screen, and scrolls when the keyboard needs the room.
  centered: { justifyContent: 'center' },
  form: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: spacing.lg },
  brand: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  logo: { width: 84, height: 84, borderRadius: radius.lg + spacing.xs, marginBottom: spacing.sm },
});
