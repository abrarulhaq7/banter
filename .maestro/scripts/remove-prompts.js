// Deletes the tones this run's test account edited or made.
// Runs inside Maestro. Needs SUPABASE_URL, SUPABASE_KEY, EMAIL and PASSWORD.

const login = http.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
// No account (the flow failed before sign-up): nothing to clean.
if (login.status === 200) {
  const token = json(login.body).access_token;
  const removed = http.delete(SUPABASE_URL + '/rest/v1/user_prompts?id=not.is.null', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token },
  });
  if (removed.status >= 300) throw new Error('Deleting the tones failed: ' + removed.status);
} else {
  console.log('Clean-up skipped: no test account to sign in to (' + login.status + ').');
}
