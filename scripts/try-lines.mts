/**
 * Runs sample screenshots through the generation engine and prints what comes back.
 * This is the tool for judging and tuning the prompts (PLAN.md, Phase 3).
 *
 *   npm run lines -- samples/                      every image in the folder
 *   npm run lines -- samples/story1.png --tone funny --mode story_reply
 *   npm run lines -- samples/ --provider claude --all-tones
 *   npm run lines -- samples/chat1.png --mode analyse
 *   npm run lines -- samples/story1.png --show-prompt
 *
 * Options
 *   --provider gemini|groq|openrouter|openai|claude   default: the first provider with a key
 *   --model <id>                      default: the provider's default model
 *   --mode story_reply|opener|reply|analyse|auto
 *                                     default: auto (from the file name, else story_reply)
 *   --tone casual|funny|flirty|spicy|confident|safe   default: casual
 *   --all-tones                       run each image once per tone
 *   --context stranger|mutual_follow|know_her|already_talking
 *   --about "free text"               how the sender texts (stands in for the profile)
 *   --her "free text"                 the sender's note about her ("close friend, she flirts back")
 *   --direction keep_going|heat_up|ask_out   Reply only: where to take the chat
 *   --language english|roman_urdu     the language of the lines (default english)
 *   --focus "free text"               what the lines should be about ("her nails"): five lines,
 *                                     the first three about it
 *   --delay <ms>                      wait between requests (free tiers allow few per minute)
 *   --show-prompt                     print the exact prompt that is sent
 *   --json                            print the raw result as JSON
 *
 * Keys are read from keys.local.json (not in git):
 *   { "gemini": "...", "groq": "...", "openrouter": "...", "openai": "...", "claude": "..." }
 *
 * Screenshots are resized to 1280 px on the longest side before sending, like the app will.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';

import {
  DEFAULT_CORE,
  DEFAULT_MODES,
  DEFAULT_TONES,
  MAX_IMAGE_SIDE,
  buildPrompt,
  generate,
  isEngineError,
  type ContextId,
  type GenerationResult,
  type ImageInput,
  type ModeId,
  type PromptInput,
  type ToneId,
} from '../src/engine';
import type { ProviderId } from '../src/lib/database.types';

/** The default model for each provider. Same as the defaults in the `models` table. */
const DEFAULT_MODEL: Record<ProviderId, string> = {
  gemini: 'gemini-3.5-flash-lite',
  groq: 'qwen/qwen3.8-27b',
  openrouter: 'nvidia/nemotron-3.5-super-vl:free',
  openai: 'gpt-6-luna',
  claude: 'claude-haiku-5-5',
};
const PROVIDERS: ProviderId[] = ['gemini', 'groq', 'openrouter', 'openai', 'claude'];
const MODES = Object.keys(DEFAULT_MODES) as ModeId[];
const TONES = Object.keys(DEFAULT_TONES) as ToneId[];
const CONTEXTS: ContextId[] = ['stranger', 'mutual_follow', 'know_her', 'already_talking'];
const IMAGE_TYPES = new Set(['.png', '.jpg', '.jpeg', '.heic', '.webp']);

const root = resolve(import.meta.dirname, '..');

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(2);
}

// --- arguments ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = new Map<string, string | true>();
const paths: string[] = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!arg.startsWith('--')) {
    paths.push(arg);
    continue;
  }
  const name = arg.slice(2);
  const takesValue = !['all-tones', 'show-prompt', 'json', 'help'].includes(name);
  flags.set(name, takesValue ? (args[(index += 1)] ?? '') : true);
}

if (flags.has('help') || paths.length === 0) {
  console.log(readFileSync(import.meta.filename, 'utf8').split('*/')[0].replace(/^\/\*\*\n?/, '').replace(/^ \* ?/gm, ''));
  process.exit(paths.length === 0 && !flags.has('help') ? 2 : 0);
}

function choice<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = flags.get(name);
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T)) fail(`--${name} must be one of: ${allowed.join(', ')}`);
  return value as T;
}

// --- keys --------------------------------------------------------------------------------

const keysPath = join(root, 'keys.local.json');
if (!existsSync(keysPath)) {
  fail(
    'No keys.local.json found. Create it in the project folder (it is ignored by git):\n\n' +
      '  { "gemini": "your-key", "openai": "", "claude": "" }',
  );
}
let savedKeys: Partial<Record<ProviderId, string>>;
try {
  savedKeys = JSON.parse(readFileSync(keysPath, 'utf8'));
} catch {
  fail('keys.local.json is not valid JSON. It should look like: { "gemini": "your-key" }');
}
const available = PROVIDERS.filter((provider) => (savedKeys[provider] ?? '').trim());
if (available.length === 0) fail('keys.local.json has no key in it yet.');

const provider = choice('provider', PROVIDERS, available[0]);
const apiKey = (savedKeys[provider] ?? '').trim();
if (!apiKey) fail(`keys.local.json has no ${provider} key. Keys found for: ${available.join(', ')}.`);
const model = (flags.get('model') as string | undefined) || DEFAULT_MODEL[provider];

// --- images ------------------------------------------------------------------------------

const files = paths
  .flatMap((path) => {
    const full = resolve(path);
    if (!existsSync(full)) fail(`Not found: ${path}`);
    return statSync(full).isDirectory()
      ? readdirSync(full).sort().map((name) => join(full, name))
      : [full];
  })
  .filter((file) => IMAGE_TYPES.has(extname(file).toLowerCase()));
if (files.length === 0) fail('No images found. Supported: png, jpg, jpeg, heic, webp.');

const workDir = mkdtempSync(join(tmpdir(), 'banter-lines-'));
process.on('exit', () => rmSync(workDir, { recursive: true, force: true }));

/** Resizes with macOS's built-in `sips` and returns the JPEG as base64. */
function prepare(file: string): ImageInput {
  const out = join(workDir, `${basename(file, extname(file))}.jpg`);
  execFileSync(
    'sips',
    ['-Z', String(MAX_IMAGE_SIDE), '-s', 'format', 'jpeg', '-s', 'formatOptions', '85', file, '--out', out],
    { stdio: 'ignore' },
  );
  return { base64: readFileSync(out).toString('base64'), mediaType: 'image/jpeg' };
}

/** "chat-3.png" is a chat, "profile_x.jpg" a profile, anything else a story. */
function modeFromName(file: string): ModeId {
  const name = basename(file).toLowerCase();
  if (name.includes('analy')) return 'analyse';
  if (name.includes('chat') || name.includes('dm') || name.includes('reply')) return 'reply';
  if (name.includes('profile') || name.includes('bio')) return 'opener';
  return 'story_reply';
}

// --- run ---------------------------------------------------------------------------------

const modeFlag = choice('mode', [...MODES, 'auto'] as const, 'auto');
const tones = flags.has('all-tones') ? TONES : [choice('tone', TONES, 'casual')];
const context = flags.has('context') ? choice('context', CONTEXTS, 'stranger') : null;
const about = flags.get('about');
const her = flags.get('her');
const direction = flags.get('direction');
const language = flags.get('language');
const focus = flags.get('focus');

function print(result: GenerationResult) {
  const { output } = result;
  const seconds = (result.durationMs / 1000).toFixed(1);
  console.log(`  username: ${output.username ?? '(not read)'}   screen: ${output.screenType}   ${seconds}s`);
  if (output.kind === 'lines' && output.read) console.log(`  read:     ${output.read}`);
  if (output.noticed) console.log(`  noticed:  ${output.noticed}`);

  if (output.kind === 'declined') {
    console.log(`  DECLINED: ${output.reason}`);
  } else if (output.kind === 'analysis') {
    console.log(`  interest: ${output.interest}`);
    output.signals.forEach((signal) => console.log(`    - ${signal}`));
    console.log(`  advice:   ${output.advice}`);
    console.log(`  reply:    ${output.suggestedReply ?? '(none: leave it)'}`);
  } else {
    output.lines.forEach((line, index) => {
      console.log(`  ${index + 1}. ${line.text}`);
      console.log(`       hook: ${line.hook}${line.move ? `   move: ${line.move}` : ""}`);
    });
  }
}

console.log(`Provider: ${provider}   Model: ${model}   Prompt version: ${DEFAULT_CORE.version}`);
let failures = 0;
let requests = 0;
const delayMs = Number(flags.get('delay') ?? 0) || 0;

for (const file of files) {
  const mode = modeFlag === 'auto' ? modeFromName(file) : modeFlag;
  const image = prepare(file);

  for (const tone of mode === 'analyse' ? [null] : tones) {
    const prompt: PromptInput = {
      core: DEFAULT_CORE,
      mode,
      modeInstruction: DEFAULT_MODES[mode].instruction,
      tone: tone ? DEFAULT_TONES[tone] : null,
      context,
      aboutHer: typeof her === 'string' && her ? her : null,
      direction: direction === 'heat_up' || direction === 'ask_out' ? direction : null,
      language: language === 'roman_urdu' ? 'roman_urdu' : null,
      profile: typeof about === 'string' && about ? { textingStyle: about } : null,
      focus: typeof focus === 'string' && focus ? focus : null,
    };

    const heading = [
      basename(file),
      DEFAULT_MODES[mode].label,
      tone ? DEFAULT_TONES[tone].label : null,
      context ? `context: ${context}` : null,
      prompt.focus ? `focus: ${prompt.focus}` : null,
    ]
      .filter(Boolean)
      .join('  |  ');
    console.log(`\n${'='.repeat(88)}\n${heading}\n${'-'.repeat(88)}`);

    if (flags.has('show-prompt')) {
      const built = buildPrompt(prompt);
      console.log(`[system]\n${built.system}\n\n[with the screenshot]\n${built.user}\n${'-'.repeat(88)}`);
    }

    if (delayMs > 0 && requests > 0) await new Promise((done) => setTimeout(done, delayMs));
    requests += 1;
    try {
      const result = await generate({
        keys: [{ id: 'cli', label: 'keys.local.json', provider, key: apiKey, model }],
        prompt,
        image,
      });
      if (flags.has('json')) console.log(JSON.stringify(result, null, 2));
      else print(result);
    } catch (error) {
      failures += 1;
      if (isEngineError(error)) {
        console.log(`  FAILED (${error.kind}): ${error.message}`);
        if (error.detail) console.log(`  detail: ${error.detail}`);
        // These will not get better on the next image.
        if (['wrong_key', 'no_internet', 'limit', 'no_credit'].includes(error.kind)) process.exit(1);
      } else {
        throw error;
      }
    }
  }
}

console.log(`\n${files.length} image(s), ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
