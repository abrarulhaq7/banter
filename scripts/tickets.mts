/**
 * Finds and resolves feedback tickets sent from the app. Signs in as the admin account
 * (admin-account.local.json, not in git; make it once with `npm run admin:setup`).
 *
 *   npm run tickets -- someone@example.com          that email's tickets, newest first
 *   npm run tickets -- --open                       every open ticket
 *   npm run tickets -- --resolve <id> "what was done"
 *   add --json to print each ticket's whole context, with the request as sent
 *
 * The screenshot of a reported set is saved in tickets.local/ (not in git).
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(2);
}

function env(): Record<string, string> {
  const path = join(root, '.env.local');
  if (!existsSync(path)) fail('No .env.local with the Supabase address and publishable key.');
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => {
        const at = line.indexOf('=');
        return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

const args = process.argv.slice(2);
const json = args.includes('--json');
const rest = args.filter((arg) => arg !== '--json');

const accountPath = join(root, 'admin-account.local.json');
if (!existsSync(accountPath)) fail('No admin-account.local.json. Run `npm run admin:setup` first.');
const account = JSON.parse(readFileSync(accountPath, 'utf8')) as { email: string; password: string };

const { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } = env();
if (!url || !key) fail('.env.local is missing the Supabase address or publishable key.');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const signedIn = await supabase.auth.signInWithPassword(account);
if (signedIn.error) fail(`Could not sign in as the admin: ${signedIn.error.message}`);
const { data: isAdmin } = await supabase.rpc('is_admin');
if (!isAdmin) fail('This account is not an admin yet. Paste supabase/paste-admin.sql into the SQL editor.');

type Ticket = {
  id: string;
  email: string | null;
  kind: string;
  message: string;
  context: Record<string, any>;
  screenshot_path: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
};

const columns = 'id, email, kind, message, context, screenshot_path, status, resolution, created_at';

async function resolveTicket(idOrStart: string, note: string) {
  const { data, error } = await supabase.from('feedback').select('id').order('created_at', { ascending: false });
  if (error) fail(error.message);
  const matches = (data ?? []).filter((row) => row.id.startsWith(idOrStart));
  if (matches.length !== 1) fail(`${matches.length} tickets start with "${idOrStart}". Give more of the id.`);
  const { error: updateError } = await supabase
    .from('feedback')
    .update({ status: 'resolved', resolution: note, resolved_at: new Date().toISOString() })
    .eq('id', matches[0].id);
  if (updateError) fail(updateError.message);
  console.log(`Resolved ${matches[0].id}: ${note}`);
}

async function saveScreenshot(ticket: Ticket): Promise<string | null> {
  if (!ticket.screenshot_path) return null;
  const { data, error } = await supabase.storage.from('screenshots').download(ticket.screenshot_path);
  if (error || !data) return `(could not download: ${error?.message ?? 'no data'})`;
  const folder = join(root, 'tickets.local');
  mkdirSync(folder, { recursive: true });
  const file = join(folder, `${ticket.id.slice(0, 8)}.jpg`);
  writeFileSync(file, Buffer.from(await data.arrayBuffer()));
  return file;
}

function describeSet(set: Record<string, any>) {
  const facts = [
    [set.tone, set.mode].filter(Boolean).join(' · '),
    set.model,
    set.promptVersion ? `rules v${set.promptVersion}` : null,
    set.seconds ? `${set.seconds} s` : null,
    set.howYouKnowHer,
    set.direction,
    set.adjustment,
    set.fix ? `fix: ${set.fix}` : null,
    set.username ? `@${set.username}` : null,
  ].filter(Boolean);
  console.log(`set:     ${facts.join(' · ')}`);
  if (set.noticed) console.log(`noticed: ${set.noticed}`);
  if (set.read) console.log(`read:    ${set.read}`);
  for (const [index, line] of (set.lines ?? []).entries()) {
    const marks = [
      line.liked ? 'liked' : null,
      line.notForMe ? `not for me: ${line.notForMe}` : null,
      line.copied ? 'copied' : null,
      line.saved ? 'saved' : null,
    ].filter(Boolean);
    console.log(`  ${index + 1}. ${marks.length ? `[${marks.join(', ')}] ` : ''}${line.text}`);
    console.log(`       hook: ${line.hook}${line.move ? ` · move: ${line.move}` : ''}`);
  }
  if (set.advice) console.log(`analysis: ${set.interest}, ${set.advice} Reply: ${set.suggestedReply ?? '(leave it)'}`);
  if (set.declined) console.log(`declined: ${set.declined}`);
}

async function show(tickets: Ticket[]) {
  if (tickets.length === 0) return console.log('No tickets.');
  for (const ticket of tickets) {
    const app = ticket.context.app ?? {};
    console.log(`\n=== ${ticket.id.slice(0, 8)}  ${ticket.created_at.slice(0, 16).replace('T', ' ')}  ${ticket.kind.toUpperCase()}  ${ticket.status}  ${ticket.email ?? ''}`);
    console.log(`note:    ${ticket.message || '(none)'}`);
    console.log(`from:    ${ticket.context.where ?? '?'} · Banter ${app.version ?? '?'} on ${app.platform ?? '?'} ${app.os ?? ''}${app.device ? ` (${app.device})` : ''}`);
    if (ticket.context.set) describeSet(ticket.context.set);
    const shot = await saveScreenshot(ticket);
    if (shot) console.log(`screenshot: ${shot}`);
    if (ticket.status === 'resolved') console.log(`resolved: ${ticket.resolution ?? ''}`);
    if (json) console.log(JSON.stringify(ticket.context, null, 2));
  }
}

if (rest[0] === '--resolve') {
  if (!rest[1] || !rest[2]) fail('Usage: npm run tickets -- --resolve <id> "what was done"');
  await resolveTicket(rest[1], rest[2]);
} else if (rest[0] === '--open') {
  const { data, error } = await supabase.from('feedback').select(columns).eq('status', 'open').order('created_at', { ascending: false });
  if (error) fail(error.message);
  await show((data ?? []) as Ticket[]);
} else if (rest[0]) {
  const { data, error } = await supabase
    .from('feedback')
    .select(columns)
    .ilike('email', rest[0].trim())
    .order('created_at', { ascending: false });
  if (error) fail(error.message);
  await show((data ?? []) as Ticket[]);
} else {
  fail('Usage: npm run tickets -- <email> | --open | --resolve <id> "what was done"   (add --json for everything)');
}
await supabase.auth.signOut();
