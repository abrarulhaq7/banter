import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MIN_PASSWORD_LENGTH, useAuth, validateEmail, validatePassword } from '@/auth';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { spacing } from '@/theme';

type AuthFormProps = {
  mode: 'signIn' | 'signUp';
};

const COPY = {
  signIn: {
    subtitle: 'Sign in to continue.',
    submit: 'Sign in',
    switchLabel: 'Create an account',
    switchTo: '/sign-up',
  },
  signUp: {
    subtitle: 'Create your account.',
    submit: 'Create account',
    switchLabel: 'I already have an account',
    switchTo: '/sign-in',
  },
} as const;

/** The sign-in and sign-up screens. They differ only in wording and password rules. */
export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { signIn, signUp, setupProblem } = useAuth();
  const copy = COPY[mode];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password, mode);

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
    <Screen testID={mode === 'signIn' ? 'sign-in-screen' : 'sign-up-screen'}>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Banter
        </AppText>
        <AppText color="textMuted">{copy.subtitle}</AppText>
      </View>

      {setupProblem ? (
        <Card testID="setup-problem">
          <AppText variant="label" color="accentAlt">
            Setup needed
          </AppText>
          <AppText variant="caption" color="textMuted">
            {setupProblem}
          </AppText>
        </Card>
      ) : null}

      <View style={styles.fields}>
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
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          error={showFieldErrors ? passwordError : undefined}
          helper={mode === 'signUp' ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
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
      </View>

      {formError ? (
        <AppText testID="form-error" color="danger" accessibilityRole="alert">
          {formError}
        </AppText>
      ) : null}
      {notice ? (
        <AppText testID="form-notice" color="success" accessibilityRole="alert">
          {notice}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button testID="submit-button" label={copy.submit} onPress={submit} loading={busy} />
        <Button
          testID="switch-button"
          variant="ghost"
          label={copy.switchLabel}
          disabled={busy}
          onPress={() => router.replace(copy.switchTo)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xxl },
  fields: { gap: spacing.lg },
  actions: { gap: spacing.sm },
});
