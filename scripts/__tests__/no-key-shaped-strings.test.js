/**
 * No file in the project may contain a string shaped like a real provider key, not even
 * a made-up one for a test. GitHub and other scanners match on shape, so a fake that
 * looks real raises a "secret detected" alert (this happened on 2026-11-25).
 *
 * Fake keys in tests and flows should look fake: "fake-gemini-key-for-tests".
 */
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const ROOT = join(__dirname, '..', '..');
const FOLDERS = ['src', 'scripts', 'supabase', '.maestro'];
const ROOT_FILES = ['PLAN.md', 'AGENTS.md', 'app.json', 'package.json', '.env.example', 'eslint.config.js'];
const SKIP_FOLDERS = new Set(['node_modules', 'artifacts', '.temp']);
// Generated for pasting into Supabase; never committed.
const SKIP_FILES = new Set(['paste-into-sql-editor.sql', 'paste-prompts.sql']);

const KEY_SHAPES = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['OpenAI project key', /sk-proj-[A-Za-z0-9_-]{20,}/],
  ['OpenAI key', /sk-[A-Za-z0-9]{40,}/],
  ['Anthropic key', /sk-ant-[A-Za-z0-9]+-[A-Za-z0-9_-]{40,}/],
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{16,}/],
  ['Supabase publishable key', /sb_publishable_[A-Za-z0-9_-]{16,}/],
  ['JWT (old Supabase key)', /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
];

function filesUnder(folder) {
  return readdirSync(folder).flatMap((name) => {
    if (SKIP_FOLDERS.has(name) || SKIP_FILES.has(name)) return [];
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('project files', () => {
  const files = [
    ...FOLDERS.flatMap((folder) => filesUnder(join(ROOT, folder))),
    ...ROOT_FILES.map((name) => join(ROOT, name)),
  ].filter((path) => !/\.(png|jpg|jpeg|heic|ttf|ico)$/i.test(path));

  it('finds the files to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('contain nothing shaped like a real provider key', () => {
    const found = [];
    for (const path of files) {
      // This file describes the shapes; it does not contain a key.
      if (path === __filename) continue;
      const text = readFileSync(path, 'utf8');
      for (const [name, shape] of KEY_SHAPES) {
        if (shape.test(text)) found.push(`${relative(ROOT, path)}: looks like a ${name}`);
      }
    }
    expect(found).toEqual([]);
  });
});
