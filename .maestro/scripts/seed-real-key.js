// Saves the real Gemini key from keys.local.json into this run's test account, so the
// Generate screen can be tested with real answers. remove-keys.js takes it out again.
// Runs inside Maestro. Needs SUPABASE_URL, SUPABASE_KEY, GEMINI_KEY, EMAIL and PASSWORD.

if (!GEMINI_KEY) throw new Error('No Gemini key. Put one in keys.local.json and run through npm run e2e:live.');

const login = http.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
  headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (login.status !== 200) throw new Error('Sign-in for seeding failed: ' + login.status);
const token = json(login.body).access_token;

const saved = http.post(SUPABASE_URL + '/rest/v1/api_keys', {
  headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider: 'gemini', label: 'Test key', key: GEMINI_KEY, sort_order: 0 }),
});
if (saved.status >= 300) throw new Error('Saving the key failed: ' + saved.status);
