// Deletes everything the History flow saved in this run's test account: the stored
// screenshots, and the people, interactions and lines.
// Runs inside Maestro. Needs SUPABASE_URL, SUPABASE_KEY, EMAIL and PASSWORD.

const login = http.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
// No account (the flow failed before sign-up): nothing to clean.
if (login.status === 200) {
  const session = json(login.body);
  // Deletes carry no body, and storage refuses a JSON content type on a request without one.
  const auth = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + session.access_token };
  const headers = { apikey: auth.apikey, Authorization: auth.Authorization, 'Content-Type': 'application/json' };
  const userId = session.user.id;

  const listed = http.post(SUPABASE_URL + '/storage/v1/object/list/screenshots', {
    headers: headers,
    body: JSON.stringify({ prefix: userId, limit: 100 }),
  });
  if (listed.status !== 200) throw new Error('Listing screenshots failed: ' + listed.status);
  json(listed.body).forEach(function (file) {
    const removed = http.delete(SUPABASE_URL + '/storage/v1/object/screenshots/' + userId + '/' + file.name, {
      headers: auth,
    });
    if (removed.status >= 300) throw new Error('Deleting a screenshot failed: ' + removed.status);
  });

  // Lines go with their interaction; interactions without a person are deleted on their own.
  ['interactions', 'people'].forEach(function (table) {
    const removed = http.delete(SUPABASE_URL + '/rest/v1/' + table + '?id=not.is.null', { headers: auth });
    if (removed.status >= 300) throw new Error('Deleting ' + table + ' failed: ' + removed.status);
  });
} else {
  console.log('Clean-up skipped: no test account to sign in to (' + login.status + ').');
}
