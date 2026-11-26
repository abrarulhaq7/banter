import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MIN_PASSWORD_LENGTH, useAuth, validateEmail, validatePassword } from '@/auth';
import { AppText, Banner, Button, Icon, Screen, TextField } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

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
  const { colors } = useTheme();
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
    <Screen
      testID={mode === 'signIn' ? 'sign-in-screen' : 'sign-up-screen'}
      fill
      footer={
        <>
          <Button testID="submit-button" label={copy.submit} onPress={submit} loading={busy} />
          <Button
            testID="switch-button"
            variant="ghost"
            label={copy.switchLabel}
            disabled={busy}
            onPress={() => router.replace(copy.switchTo)}
          />
        </>
      }>
      <View style={styles.header}>
        <View style={[styles.mark, { backgroundColor: colors.accentSoft }]}>
          <Icon name="generate" size={28} color="accent" />
        </View>
        <AppText variant="display" accessibilityRole="header">
          Banter
        </AppText>
        <AppText color="textMuted">{copy.subtitle}</AppText>
      </View>

      {setupProblem ? (
        <Banner testID="setup-problem" tone="warning" title="Setup needed">
          {setupProblem}
        </Banner>
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
        <Banner tone="danger" messageTestID="form-error">
          {formError}
        </Banner>
      ) : null}
      {notice ? (
        <Banner tone="success" messageTestID="form-notice">
          {notice}
        </Banner>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xl },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  fields: { gap: spacing.lg },
});
