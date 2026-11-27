// Reads this run's test account straight from Supabase and checks what the Data flow
// should have left there. EXPECT is one of:
//   "theme-ember":     the profile's theme is Ember;
//   "no-screenshot":   one interaction saved, no file stored (saving screenshots is off);
//   "one-screenshot":  two interactions saved, one file stored (saving is on again);
//   "person-deleted":  no people, interactions, lines or files; the key is still there;
//   "history-deleted": the same, after "Delete all history";
//   "account-deleted": the login no longer works.
// Saving happens in the background, so a check is repeated a few times before giving up.
// Runs inside Maestro. Needs SUPABASE_URL, SUPABASE_KEY, EMAIL, PASSWORD and EXPECT.

const login = http.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

if (EXPECT === 'account-deleted') {
  if (login.status === 200) throw new Error('Data check failed: the deleted account can still sign in.');
  console.log('Data check passed (account-deleted): sign-in answers ' + login.status + '.');
} else {
  if (login.status !== 200) throw new Error('Sign-in for checking failed: ' + login.status);
  const session = json(login.body);
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + session.access_token,
    'Content-Type': 'application/json',
  };
  const userId = session.user.id;

  const read = function (path) {
    const response = http.get(SUPABASE_URL + '/rest/v1/' + path, { headers: headers });
    if (response.status !== 200) throw new Error('Reading ' + path + ' failed: ' + response.status + ' ' + response.body);
    return json(response.body);
  };
  const storedFiles = function () {
    const listed = http.post(SUPABASE_URL + '/storage/v1/object/list/screenshots', {
      headers: headers,
      body: JSON.stringify({ prefix: userId, limit: 100 }),
    });
    if (listed.status !== 200) throw new Error('Listing screenshots failed: ' + listed.status);
    return json(listed.body).length;
  };

  /** Returns the first thing that is wrong, or null when everything is as expected. */
  const problem = function () {
    if (EXPECT === 'theme-ember') {
      const theme = read('profiles?select=theme')[0].theme;
      return theme === 'ember' ? null : 'the profile\'s theme is ' + theme;
    }

    const people = read('people?select=id').length;
    const interactions = read('interactions?select=id,screenshot_path');
    const lines = read('lines?select=id').length;
    const files = storedFiles();
    const keys = read('api_keys?select=id').length;

    if (EXPECT === 'no-screenshot' || EXPECT === 'one-screenshot') {
      const wanted = EXPECT === 'no-screenshot' ? { interactions: 1, files: 0 } : { interactions: 2, files: 1 };
      if (interactions.length !== wanted.interactions) return 'expected ' + wanted.interactions + ' interaction(s), found ' + interactions.length;
      if (files !== wanted.files) return 'expected ' + wanted.files + ' stored file(s), found ' + files;
      if (lines < 3 * wanted.interactions) return 'expected at least ' + 3 * wanted.interactions + ' lines, found ' + lines;
      // The path is kept even without a file: it says which sets belong to one screenshot.
      if (interactions.some(function (row) { return !row.screenshot_path; })) return 'an interaction has no screenshot path';
      const usage = read('usage_summary?select=key_label,generations,this_month');
      if (usage.length !== 1 || usage[0].generations !== wanted.interactions) return 'usage says ' + JSON.stringify(usage);
      return null;
    }

    // person-deleted and history-deleted
    if (people !== 0) return people + ' people left';
    if (interactions.length !== 0) return interactions.length + ' interactions left';
    if (lines !== 0) return lines + ' lines left';
    if (files !== 0) return files + ' stored files left';
    if (keys !== 1) return 'expected the key to still be there, found ' + keys;
    return null;
  };

  let found = problem();
  for (let attempt = 0; found && attempt < 10; attempt += 1) {
    // Maestro's scripts have no sleep; a slow request does the waiting.
    http.get(SUPABASE_URL + '/rest/v1/tones?select=id&limit=1', { headers: headers });
    found = problem();
  }
  if (found) throw new Error('Data check (' + EXPECT + ') failed: ' + found);
  console.log('Data check passed (' + EXPECT + ').');
}
