// Puts two made-up keys straight into the test account's rows in Supabase, so the keys
// screens can be tested without a real key. The app itself would refuse to save these.
// Runs inside Maestro. Needs SUPABASE_URL, SUPABASE_KEY, EMAIL and PASSWORD.

const login = http.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (login.status !== 200) throw new Error('Sign-in for seeding failed: ' + login.status);
const token = json(login.body).access_token;

const saved = http.post(SUPABASE_URL + '/rest/v1/api_keys', {
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([
    { provider: 'gemini', label: 'Seed A', key: 'AIzaSySeedKeyA-not-real-000000000000000', sort_order: 0 },
    { provider: 'openai', label: 'Seed B', key: 'sk-seed-key-b-not-real-0000000000000000', sort_order: 1 },
  ]),
});
if (saved.status >= 300) throw new Error('Seeding keys failed: ' + saved.status + ' ' + saved.body);
