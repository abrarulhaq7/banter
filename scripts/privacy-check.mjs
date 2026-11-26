#!/usr/bin/env node
// Privacy check against the real Supabase project.
//
// Creates two test users and confirms that one cannot read, change or delete the other's
// rows or files, and that a signed-out visitor can reach nothing.
//
//   npm run test:privacy
//
// Needs .env.local with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
// the migrations applied, and "Confirm email" turned off.
//
// The script deletes the rows and files it creates. The two test accounts stay, because
// only a secret key can delete accounts. To remove them too, run with the secret key in
// the environment (never save it in a file in this project):
//   SUPABASE_SECRET_KEY=sb_secret_... npm run test:privacy

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

// --- settings ----------------------------------------------------------------------------

function readEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const at = line.indexOf('=');
          return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^["']|["']$/g, '')];
        }),
    );
  } catch {
    return {};
  }
}

const root = resolve(import.meta.dirname, '..');
const env = { ...readEnvFile(resolve(root, '.env')), ...readEnvFile(resolve(root, '.env.local')), ...process.env };
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey) {
  console.error(
    'Supabase is not connected. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local first.',
  );
  process.exit(2);
}

// --- reporting ---------------------------------------------------------------------------

let passed = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok - ${label}`);
  } else {
    failures.push(label);
    console.log(`FAILED - ${label}${detail ? ` (${detail})` : ''}`);
  }
}

/** For steps that must work for the rest of the script to mean anything. */
function must(label, error) {
  if (error) {
    console.error(`\nCould not ${label}: ${error.message ?? error}`);
    console.error('Stopping. Nothing can be concluded about privacy from this run.');
    process.exit(2);
  }
}

const newClient = () =>
  createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });

const USER_TABLES = ['api_keys', 'user_prompts', 'people', 'interactions', 'lines'];
const REFERENCE_TABLES = ['models', 'prompt_core', 'modes', 'tones'];
const BUCKET = 'screenshots';
// The smallest valid JPEG: start marker and end marker.
const TINY_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

async function signUp(label, stamp) {
  const client = newClient();
  const email = `banter.privacy.${label}.${stamp}@example.com`;
  const password = `privacy-check-${crypto.randomUUID()}`;
  const { data, error } = await client.auth.signUp({ email, password });
  must(`create test user ${label.toUpperCase()}`, error);
  if (!data.session) {
    must(
      `sign in test user ${label.toUpperCase()}`,
      new Error('no session returned. Turn off "Confirm email" in Supabase (Authentication > Sign In / Providers > Email).'),
    );
  }
  return { client, id: data.user.id, email };
}

// --- the check ---------------------------------------------------------------------------

const stamp = Date.now();
console.log(`Project: ${new URL(url).host}\n`);

const a = await signUp('a', stamp);
const b = await signUp('b', stamp);
const visitor = newClient();

// A creates one of everything.
const key = await a.client
  .from('api_keys')
  .insert({ provider: 'gemini', label: 'Privacy check', key: 'not-a-real-key-privacy-check' })
  .select()
  .single();
must('create a key as A (are the migrations applied?)', key.error);

const person = await a.client
  .from('people')
  .insert({ username: `privacy.check.${stamp}`.slice(0, 30), context: 'stranger' })
  .select()
  .single();
must('create a person as A', person.error);

const path = `${a.id}/privacy-check-${stamp}.jpg`;
const upload = await a.client.storage.from(BUCKET).upload(path, TINY_JPEG, { contentType: 'image/jpeg' });
must('upload a screenshot as A', upload.error);

const interaction = await a.client
  .from('interactions')
  .insert({
    person_id: person.data.id,
    mode_id: 'opener',
    tone_id: 'casual',
    provider: 'gemini',
    model: 'privacy-check',
    api_key_id: key.data.id,
    screenshot_path: path,
  })
  .select()
  .single();
must('create an interaction as A', interaction.error);

const line = await a.client
  .from('lines')
  .insert({ interaction_id: interaction.data.id, position: 1, text: 'Privacy check line' })
  .select()
  .single();
must('create a line as A', line.error);

const prompt = await a.client
  .from('user_prompts')
  .insert({ label: 'Privacy check', content: 'Privacy check tone' })
  .select()
  .single();
must('create a custom tone as A', prompt.error);

const ownRows = {
  api_keys: key.data.id,
  user_prompts: prompt.data.id,
  people: person.data.id,
  interactions: interaction.data.id,
  lines: line.data.id,
};

check('A: a profile row was created at sign-up', (await a.client.from('profiles').select('id')).data?.length === 1);
check('A: new rows are owned by A', key.data.user_id === a.id && line.data.user_id === a.id);
check(
  'A: can download own screenshot',
  !(await a.client.storage.from(BUCKET).download(path)).error,
);

// B tries everything against A's data.
for (const table of USER_TABLES) {
  const id = ownRows[table];

  const all = await b.client.from(table).select('id');
  check(`B: cannot read A's ${table}`, !all.error && all.data.length === 0, all.error?.message);

  const byId = await b.client.from(table).select('id').eq('id', id);
  check(`B: cannot read A's ${table} row even with its id`, !byId.error && byId.data.length === 0);

  const stolen = await b.client.from(table).update({ user_id: b.id }).eq('id', id).select('id');
  check(`B: cannot take over A's ${table} row`, (stolen.data ?? []).length === 0);

  const removed = await b.client.from(table).delete().eq('id', id).select('id');
  check(`B: cannot delete A's ${table} row`, (removed.data ?? []).length === 0);
}

const profiles = await b.client.from('profiles').select('id');
check('B: sees only own profile', profiles.data?.length === 1 && profiles.data[0].id === b.id);
const profileEdit = await b.client.from('profiles').update({ display_name: 'x' }).eq('id', a.id).select('id');
check("B: cannot change A's profile", (profileEdit.data ?? []).length === 0);

const planted = await b.client
  .from('api_keys')
  .insert({ user_id: a.id, provider: 'openai', label: 'planted', key: 'not-a-real-key-planted' });
check("B: cannot create a key in A's name", Boolean(planted.error));
const attached = await b.client
  .from('lines')
  .insert({ interaction_id: interaction.data.id, position: 2, text: 'planted' });
check("B: cannot add a line to A's interaction", Boolean(attached.error));

check("B: cannot download A's screenshot", Boolean((await b.client.storage.from(BUCKET).download(path)).error));
const listing = await b.client.storage.from(BUCKET).list(a.id);
check("B: cannot list A's screenshot folder", (listing.data ?? []).length === 0);
const signed = await b.client.storage.from(BUCKET).createSignedUrl(path, 60);
check("B: cannot make a share link for A's screenshot", Boolean(signed.error));
const plantedFile = await b.client.storage
  .from(BUCKET)
  .upload(`${a.id}/planted-${stamp}.jpg`, TINY_JPEG, { contentType: 'image/jpeg' });
check("B: cannot upload into A's folder", Boolean(plantedFile.error));
await b.client.storage.from(BUCKET).remove([path]);
check("B: cannot delete A's screenshot", !(await a.client.storage.from(BUCKET).download(path)).error);

// Reference tables: readable, not writable.
const modes = await b.client.from('modes').select('id');
check('signed in: can read the default modes', modes.data?.length === 4, modes.error?.message);
for (const table of REFERENCE_TABLES) {
  const edit = await b.client.from(table).delete().not('created_at', 'is', null).select();
  check(`signed in: cannot delete from ${table}`, Boolean(edit.error) || (edit.data ?? []).length === 0);
}
const tones = await b.client.from('tones').update({ definition: 'changed' }).eq('id', 'casual').select();
check('signed in: cannot edit a default tone', Boolean(tones.error) || (tones.data ?? []).length === 0);

// A signed-out visitor.
for (const table of [...USER_TABLES, 'profiles', ...REFERENCE_TABLES]) {
  const read = await visitor.from(table).select('*').limit(1);
  check(`signed out: cannot read ${table}`, Boolean(read.error) || read.data.length === 0);
}
check(
  'signed out: cannot download a screenshot',
  Boolean((await visitor.storage.from(BUCKET).download(path)).error),
);
const publicUrl = visitor.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
check('signed out: the public address of a screenshot does not work', !(await fetch(publicUrl)).ok);

// A's data survived all of that.
const still = await a.client.from('api_keys').select('key').eq('id', key.data.id).single();
check("A: key is unchanged after B's attempts", still.data?.key === 'not-a-real-key-privacy-check');
check(
  "A: all rows are still there after B's attempts",
  (
    await Promise.all(USER_TABLES.map((table) => a.client.from(table).select('id').eq('id', ownRows[table])))
  ).every((result) => result.data?.length === 1),
);

// --- clean up ----------------------------------------------------------------------------

await a.client.storage.from(BUCKET).remove([path]);
await a.client.from('people').delete().eq('id', person.data.id); // also removes the interaction and line
await a.client.from('api_keys').delete().eq('id', key.data.id);
await a.client.from('user_prompts').delete().eq('id', prompt.data.id);

if (secretKey) {
  const admin = createClient(url, secretKey, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(a.id);
  await admin.auth.admin.deleteUser(b.id);
  console.log('\nTest rows, file and both test accounts deleted.');
} else {
  console.log(`\nTest rows and file deleted. Two test accounts remain: ${a.email}, ${b.email}`);
  console.log('Delete them in the Supabase dashboard under Authentication > Users when you like.');
}

console.log(`\n${passed} checks passed, ${failures.length} failed.`);
if (failures.length > 0) {
  console.log('\nPRIVACY CHECK FAILED:');
  for (const label of failures) console.log(`  - ${label}`);
  process.exit(1);
}
console.log('Privacy check passed.');
