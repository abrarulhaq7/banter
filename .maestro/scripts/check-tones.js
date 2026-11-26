// Reads this run's test account straight from Supabase and checks what the Tones flow
// should have saved. EXPECT is one of:
//   "edited-and-custom": a personal version of Flirty and one tone of the user's own;
//   "generated": as above, and the newest interaction was written with the personal Flirty;
//   "reset": no personal version of Flirty any more; the own tone is still there, and the
//            interaction is still saved, without its link to the deleted version.
// Saving happens in the background, so the check is repeated a few times before giving up.
// Also checks that the app can read the default prompts, which is all it is allowed to do.
// Runs inside Maestro. Needs SUPABASE_URL, SUPABASE_KEY, EMAIL, PASSWORD and EXPECT.

const login = http.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (login.status !== 200) throw new Error('Sign-in for checking failed: ' + login.status);
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + json(login.body).access_token,
  'Content-Type': 'application/json',
};

function read(path) {
  const response = http.get(SUPABASE_URL + '/rest/v1/' + path, { headers: headers });
  if (response.status !== 200) throw new Error('Reading ' + path + ' failed: ' + response.status + ' ' + response.body);
  return json(response.body);
}

/** Returns the first thing that is wrong, or null when everything is as expected. */
function problem() {
  // The same three reads the app makes on start.
  const core = read('prompt_core?select=version,rules,output_format&is_active=eq.true');
  if (core.length !== 1) return 'expected 1 active set of core rules, found ' + core.length;
  if (read('modes?select=id,label,instruction,sort_order&is_active=eq.true').length < 4) return 'fewer than 4 modes';
  if (read('tones?select=id,label,definition,sort_order&is_active=eq.true').length < 5) return 'fewer than 5 tones';
  output.coreVersion = core[0].version;

  const prompts = read('user_prompts?select=id,tone_id,mode_id,label,content');
  const flirty = prompts.filter(function (row) { return row.tone_id === 'flirty'; });
  const own = prompts.filter(function (row) { return row.tone_id === null && row.mode_id === null; });

  if (own.length !== 1) return 'expected 1 tone of the user\'s own, found ' + own.length;
  if (own[0].label !== 'Dry') return 'the own tone is named ' + own[0].label;

  if (EXPECT === 'reset') {
    if (flirty.length !== 0) return 'a personal version of Flirty is still saved';
  } else {
    if (flirty.length !== 1) return 'expected 1 personal version of Flirty, found ' + flirty.length;
    if (flirty[0].content.indexOf('pineapple') === -1) return 'the personal Flirty says: ' + flirty[0].content;
  }

  if (EXPECT === 'generated' || EXPECT === 'reset') {
    const interactions = read('interactions?select=tone_id,tone_label,user_prompt_id&order=created_at.desc&limit=1');
    if (interactions.length !== 1) return 'no interaction saved yet';
    if (interactions[0].tone_id !== 'flirty') return 'the interaction has tone ' + interactions[0].tone_id;
    if (EXPECT === 'generated' && interactions[0].user_prompt_id !== flirty[0].id) {
      return 'the interaction does not point at the personal Flirty';
    }
    if (EXPECT === 'reset' && interactions[0].user_prompt_id !== null) {
      return 'the interaction still points at the deleted version';
    }
  }
  return null;
}

let found = problem();
for (let attempt = 0; found && attempt < 10; attempt += 1) {
  // Maestro's scripts have no sleep; a slow request does the waiting.
  http.get(SUPABASE_URL + '/rest/v1/tones?select=id&limit=1', { headers: headers });
  found = problem();
}
if (found) throw new Error('Tones check (' + EXPECT + ') failed: ' + found);
console.log('Tones check passed (' + EXPECT + '). Core rules in Supabase: version ' + output.coreVersion + '.');
