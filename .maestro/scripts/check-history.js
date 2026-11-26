// Reads this run's test account straight from Supabase and checks what the History flow
// should have saved: one person, two interactions sharing one stored screenshot, their
// lines, the copied and kept marks, and (when EXPECT_RESULT is set) the result of the
// copied line. Saving happens in the background, so the check is repeated a few times
// before it gives up.
// Runs inside Maestro. Needs SUPABASE_URL, SUPABASE_KEY, EMAIL, PASSWORD and USERNAME.

const login = http.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (login.status !== 200) throw new Error('Sign-in for checking failed: ' + login.status);
const session = json(login.body);
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + session.access_token,
  'Content-Type': 'application/json',
};
const userId = session.user.id;
const expectedResult = typeof EXPECT_RESULT === 'undefined' || EXPECT_RESULT === 'none' ? null : EXPECT_RESULT;

function read(path) {
  const response = http.get(SUPABASE_URL + '/rest/v1/' + path, { headers: headers });
  if (response.status !== 200) throw new Error('Reading ' + path + ' failed: ' + response.status + ' ' + response.body);
  return json(response.body);
}

/** Returns the first thing that is wrong, or null when everything is as expected. */
function problem() {
  const people = read('people?select=id,username,last_interaction_at');
  if (people.length !== 1) return 'expected 1 person, found ' + people.length;
  if (people[0].username !== USERNAME) return 'person is saved as ' + people[0].username;
  if (!people[0].last_interaction_at) return 'the person has no last interaction time';

  const interactions = read(
    'interactions?select=id,person_id,tone_id,mode_id,provider,screenshot_path,noticed&order=created_at.asc',
  );
  if (interactions.length !== 2) return 'expected 2 interactions, found ' + interactions.length;
  for (const row of interactions) {
    if (row.person_id !== people[0].id) return 'an interaction is not saved under the person';
    if (row.provider !== 'gemini') return 'an interaction has provider ' + row.provider;
    if (row.mode_id !== 'story_reply') return 'an interaction has mode ' + row.mode_id;
  }
  if (interactions[0].tone_id !== 'casual' || interactions[1].tone_id !== 'flirty') {
    return 'tones are ' + interactions[0].tone_id + ', ' + interactions[1].tone_id;
  }
  const path = interactions[0].screenshot_path;
  if (!path || path.indexOf(userId + '/') !== 0) return 'the screenshot path is ' + path;
  if (interactions[1].screenshot_path !== path) return 'the two sets do not share one screenshot';

  const listed = http.post(SUPABASE_URL + '/storage/v1/object/list/screenshots', {
    headers: headers,
    body: JSON.stringify({ prefix: userId, limit: 100 }),
  });
  if (listed.status !== 200) throw new Error('Listing screenshots failed: ' + listed.status + ' ' + listed.body);
  const files = json(listed.body).map(function (file) {
    return userId + '/' + file.name;
  });
  if (files.length !== 1) return 'expected 1 stored screenshot, found ' + files.length;
  if (files[0] !== path) return 'the stored file is ' + files[0];

  const lines = read('lines?select=interaction_id,position,text,copied_at,kept_at,result,result_at');
  const first = lines.filter(function (line) {
    return line.interaction_id === interactions[0].id;
  });
  const second = lines.filter(function (line) {
    return line.interaction_id === interactions[1].id;
  });
  if (first.length < 2 || second.length < 2) return 'lines per set: ' + first.length + ', ' + second.length;
  const copied = lines.filter(function (line) {
    return line.copied_at;
  });
  const kept = lines.filter(function (line) {
    return line.kept_at;
  });
  if (copied.length !== 1 || copied[0].position !== 1) return 'copied lines: ' + copied.length;
  if (kept.length !== 1 || kept[0].position !== 2) return 'kept lines: ' + kept.length;
  if (copied[0].result !== expectedResult) return 'the copied line has result ' + copied[0].result;
  if (expectedResult && !copied[0].result_at) return 'the result has no time';

  output.historyLines = lines.length;
  return null;
}

let wrong = problem();
for (let attempt = 0; wrong && attempt < 20; attempt++) wrong = problem();
if (wrong) throw new Error('History check failed: ' + wrong);
console.log('History saved as expected: 1 person, 2 interactions, ' + output.historyLines + ' lines, 1 screenshot');
