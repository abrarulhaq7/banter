import type { Session } from '@supabase/supabase-js';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AuthProvider, type AuthClient } from '@/auth';
import {
  KeysProvider,
  ProfileProvider,
  type CachedKeys,
  type KeysRepo,
  type ProfileRepo,
  type UserCache,
} from '@/data';
import {
  HistoryProvider,
  type HistoryRepo,
  type InteractionWithLines,
  type QueuedEntry,
} from '@/history';
import type {
  ApiKeyRow,
  InteractionInsert,
  LineRow,
  ModelRow,
  PersonRow,
  ProfileRow,
  ProviderId,
  UserPromptRow,
} from '@/lib/database.types';
import { PromptsProvider, type CachedPrompts, type PromptsRepo, type RemoteDefaults } from '@/prompts';
import { ThemeProvider, type ThemeName } from '@/theme';

type ThemeOptions = {
  theme?: ThemeName;
  onThemeChange?: (name: ThemeName) => void;
};

/** Renders a component inside the theme provider, the way every screen is rendered. */
export function renderWithTheme(element: ReactElement, { theme, onThemeChange }: ThemeOptions = {}) {
  return render(
    <ThemeProvider initialTheme={theme} onThemeChange={onThemeChange}>
      {element}
    </ThemeProvider>,
  );
}

type AppOptions = ThemeOptions & {
  /** Null means "Supabase is not set up". */
  client: AuthClient | null;
  setupProblem?: string;
};

/** Renders a component inside the theme and auth providers, with a fake auth client. */
export function renderWithApp(element: ReactElement, { client, setupProblem, ...theme }: AppOptions) {
  return renderWithTheme(
    <AuthProvider client={client} setupProblem={setupProblem}>
      {element}
    </AuthProvider>,
    theme,
  );
}

export function fakeSession(email = 'sam@example.com'): Session {
  return {
    access_token: 'fake-access-token',
    refresh_token: 'fake-refresh-token',
    user: { id: '11111111-1111-4111-8111-111111111111', email },
  } as unknown as Session;
}

type Listener = (event: string, session: Session | null) => void;

/**
 * A stand-in for `supabase.auth`. Like the real client, it reports the saved session
 * shortly after something subscribes. `emit` plays a later sign-in or sign-out.
 */
export function createFakeAuthClient(savedSession: Session | null = null) {
  let listener: Listener | undefined;
  const unsubscribe = jest.fn();

  const client = {
    onAuthStateChange: jest.fn((callback: Listener) => {
      listener = callback;
      void Promise.resolve().then(() => callback('INITIAL_SESSION', savedSession));
      return { data: { subscription: { unsubscribe } } };
    }),
    signInWithPassword: jest.fn(async () => ({ data: {}, error: null })),
    signUp: jest.fn(async () => ({ data: { session: fakeSession() }, error: null })),
    signOut: jest.fn(async () => ({ error: null })),
    startAutoRefresh: jest.fn(async () => {}),
    stopAutoRefresh: jest.fn(async () => {}),
  };

  return {
    client: client as unknown as AuthClient,
    mocks: client,
    unsubscribe,
    emit: (session: Session | null) => listener?.(session ? 'SIGNED_IN' : 'SIGNED_OUT', session),
  };
}

// --- Phase 2: keys and profile -------------------------------------------------------------

export function makeModels(): ModelRow[] {
  const row = (provider: ProviderId, model_id: string, label: string, is_default: boolean, sort_order: number) => ({
    provider,
    model_id,
    label,
    is_default,
    is_active: true,
    sort_order,
    created_at: '2026-11-25T00:00:00Z',
    updated_at: '2026-11-25T00:00:00Z',
  });
  return [
    row('claude', 'claude-haiku-5-5', 'Claude Haiku 5.5', true, 1),
    row('claude', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', false, 2),
    row('gemini', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', true, 1),
    row('openai', 'gpt-6-luna', 'GPT-6 Luna', true, 1),
  ];
}

export function makeKey(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: 'key-1',
    user_id: '11111111-1111-4111-8111-111111111111',
    provider: 'gemini',
    label: 'Main',
    key: 'test-gemini-key-0001',
    model: null,
    sort_order: 0,
    status: 'active',
    last_error: null,
    limited_at: null,
    last_used_at: null,
    created_at: '2026-11-25T00:00:00Z',
    updated_at: '2026-11-25T00:00:00Z',
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    display_name: null,
    age: null,
    city: null,
    work: null,
    interests: null,
    texting_style: null,
    theme: 'midnightPlum',
    settings: {},
    onboarded_at: null,
    created_at: '2026-11-25T00:00:00Z',
    updated_at: '2026-11-25T00:00:00Z',
    ...overrides,
  };
}

/** A cache that lives in memory, standing in for the phone's secure storage. */
export function createMemoryCache<T>(initial: T | null = null) {
  let value = initial;
  const cache: UserCache<T> = {
    read: jest.fn(async () => value),
    write: jest.fn(async (next: T) => {
      value = next;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
  };
  return { cache, current: () => value };
}

/** Stands in for the Supabase keys table. `failNext` makes the next call fail once. */
export function createFakeKeysRepo(initialKeys: ApiKeyRow[] = [], models: ModelRow[] = makeModels()) {
  let rows = [...initialKeys];
  let pendingFailure: unknown = null;
  let nextId = 100;
  const maybeFail = () => {
    if (pendingFailure) {
      const error = pendingFailure;
      pendingFailure = null;
      throw error;
    }
  };

  const repo: KeysRepo = {
    list: jest.fn(async () => {
      maybeFail();
      return [...rows].sort((a, b) => a.sort_order - b.sort_order);
    }),
    listModels: jest.fn(async () => models),
    add: jest.fn(async (input) => {
      maybeFail();
      const row = makeKey({ ...input, id: `key-${(nextId += 1)}` });
      rows.push(row);
      return row;
    }),
    update: jest.fn(async (id, patch) => {
      maybeFail();
      rows = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
      return rows.find((row) => row.id === id)!;
    }),
    remove: jest.fn(async (id) => {
      maybeFail();
      rows = rows.filter((row) => row.id !== id);
    }),
    setOrder: jest.fn(async (ids) => {
      maybeFail();
      rows = rows.map((row) => ({ ...row, sort_order: ids.indexOf(row.id) }));
    }),
  };

  return {
    repo,
    rows: () => rows,
    failNext: (error: unknown = new TypeError('Network request failed')) => {
      pendingFailure = error;
    },
  };
}

export function createFakeProfileRepo(initial: ProfileRow = makeProfile()) {
  let row = initial;
  let pendingFailure: unknown = null;
  const maybeFail = () => {
    if (pendingFailure) {
      const error = pendingFailure;
      pendingFailure = null;
      throw error;
    }
  };
  const repo: ProfileRepo = {
    get: jest.fn(async () => {
      maybeFail();
      return row;
    }),
    update: jest.fn(async (_userId, patch) => {
      maybeFail();
      row = { ...row, ...patch };
      return row;
    }),
  };
  return {
    repo,
    row: () => row,
    failNext: (error: unknown = new TypeError('Network request failed')) => {
      pendingFailure = error;
    },
  };
}

/** Stands in for the history tables and the screenshots bucket. */
export function createFakeHistoryRepo() {
  const people: PersonRow[] = [];
  const interactions: (InteractionInsert & { created_at: string })[] = [];
  const lines: LineRow[] = [];
  const files = new Map<string, string>();
  let pendingFailure: unknown = null;
  let nextPerson = 1;
  const maybeFail = () => {
    if (pendingFailure) {
      const error = pendingFailure;
      pendingFailure = null;
      throw error;
    }
  };
  const withLines = (row: InteractionInsert & { created_at: string }): InteractionWithLines =>
    ({
      user_id: TEST_USER_ID,
      user_prompt_id: null,
      ...row,
      lines: lines.filter((line) => line.interaction_id === row.id).sort((a, b) => a.position - b.position),
    }) as InteractionWithLines;

  const repo: HistoryRepo = {
    upsertPerson: jest.fn(async (username, context, at) => {
      maybeFail();
      let person = people.find((item) => item.username === username);
      if (!person) {
        person = {
          id: `person-${nextPerson++}`,
          user_id: TEST_USER_ID,
          username,
          context: null,
          notes: null,
          last_interaction_at: null,
          created_at: at,
          updated_at: at,
        };
        people.push(person);
      }
      person.last_interaction_at = at;
      if (context) person.context = context;
      return person.id;
    }),
    saveInteraction: jest.fn(async (row) => {
      maybeFail();
      const existing = interactions.findIndex((item) => item.id === row.id);
      const saved = { ...row, created_at: row.created_at ?? '2026-11-25T12:00:00Z' };
      if (existing >= 0) interactions[existing] = saved;
      else interactions.push(saved);
    }),
    saveLines: jest.fn(async (rows) => {
      maybeFail();
      for (const row of rows) {
        if (lines.some((line) => line.id === row.id)) continue;
        lines.push({
          user_id: TEST_USER_ID,
          copied_at: null,
          kept_at: null,
          result: null,
          result_at: null,
          created_at: '2026-11-25T12:00:00Z',
          ...row,
        });
      }
    }),
    screenshotExists: jest.fn(async (path) => files.has(path)),
    uploadScreenshot: jest.fn(async (path, localUri) => {
      maybeFail();
      files.set(path, localUri);
    }),
    patchLine: jest.fn(async (lineId, patch) => {
      maybeFail();
      const line = lines.find((item) => item.id === lineId);
      if (line) Object.assign(line, patch);
    }),
    assignPerson: jest.fn(async (interactionIds, personId) => {
      maybeFail();
      for (const row of interactions) if (interactionIds.includes(row.id)) row.person_id = personId;
    }),
    setPersonContext: jest.fn(async (personId, context) => {
      maybeFail();
      const person = people.find((item) => item.id === personId);
      if (person) person.context = context;
    }),
    removePersonIfEmpty: jest.fn(async (username) => {
      maybeFail();
      const at = people.findIndex((item) => item.username === username);
      if (at < 0 || people[at].notes) return;
      if (interactions.some((row) => row.person_id === people[at].id)) return;
      people.splice(at, 1);
    }),
    listPeople: jest.fn(async () => {
      maybeFail();
      return [...people].sort((a, b) => (b.last_interaction_at ?? '').localeCompare(a.last_interaction_at ?? ''));
    }),
    listInteractions: jest.fn(async (personId, limit) => {
      maybeFail();
      return interactions
        .filter((row) => row.person_id === personId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(withLines);
    }),
    listRecent: jest.fn(async (limit) => {
      maybeFail();
      return [...interactions]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(withLines);
    }),
    screenshotUrl: jest.fn(async (path) => (files.has(path) ? `https://signed.example/${path}` : null)),
  };

  return {
    repo,
    people,
    interactions,
    lines,
    files,
    failNext: (error: unknown = new TypeError('Network request failed')) => {
      pendingFailure = error;
    },
  };
}

export const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

// --- Phase 6: prompts ----------------------------------------------------------------------

/**
 * Stands in for the prompt tables. With no `defaults`, Supabase has nothing usable and
 * the app's own copy of the prompts is used, as on a first start without internet.
 */
export function createFakePromptsRepo(
  initial: UserPromptRow[] = [],
  defaults: RemoteDefaults = { core: null, modes: [], tones: [] },
) {
  let rows = [...initial];
  let pendingFailure: unknown = null;
  let nextId = 1;
  const maybeFail = () => {
    if (pendingFailure) {
      const error = pendingFailure;
      pendingFailure = null;
      throw error;
    }
  };
  const make = (fields: Partial<UserPromptRow>): UserPromptRow => ({
    id: `prompt-${nextId++}`,
    user_id: TEST_USER_ID,
    tone_id: null,
    mode_id: null,
    label: null,
    content: '',
    created_at: `2026-11-26T10:00:${String(nextId).padStart(2, '0')}Z`,
    updated_at: '2026-11-26T10:00:00Z',
    ...fields,
  });

  const repo: PromptsRepo = {
    loadDefaults: jest.fn(async () => {
      maybeFail();
      return defaults;
    }),
    listUserPrompts: jest.fn(async () => [...rows]),
    addToneVersion: jest.fn(async (toneId, content) => {
      maybeFail();
      const row = make({ tone_id: toneId, content });
      rows.push(row);
      return row;
    }),
    addCustomTone: jest.fn(async (label, content) => {
      maybeFail();
      const row = make({ label, content });
      rows.push(row);
      return row;
    }),
    update: jest.fn(async (id, patch) => {
      maybeFail();
      rows = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
      return rows.find((row) => row.id === id)!;
    }),
    remove: jest.fn(async (id) => {
      maybeFail();
      rows = rows.filter((row) => row.id !== id);
    }),
  };

  return {
    repo,
    rows: () => rows,
    failNext: (error: unknown = new TypeError('Network request failed')) => {
      pendingFailure = error;
    },
  };
}

export function makeUserPrompt(overrides: Partial<UserPromptRow> = {}): UserPromptRow {
  return {
    id: 'prompt-a',
    user_id: TEST_USER_ID,
    tone_id: null,
    mode_id: null,
    label: null,
    content: 'Short and dry.',
    created_at: '2026-11-26T09:00:00Z',
    updated_at: '2026-11-26T09:00:00Z',
    ...overrides,
  };
}

type DataOptions = {
  keysRepo?: KeysRepo;
  keysCache?: UserCache<CachedKeys>;
  profileRepo?: ProfileRepo;
  profileCache?: UserCache<ProfileRow>;
  historyRepo?: HistoryRepo;
  outboxCache?: UserCache<QueuedEntry[]>;
  peopleCache?: UserCache<PersonRow[]>;
  promptsRepo?: PromptsRepo;
  promptsCache?: UserCache<CachedPrompts>;
};

/** Renders inside the theme, auth, profile, keys, history and prompts providers, all backed by fakes. */
export function renderWithData(element: ReactElement, options: DataOptions = {}) {
  const userId = TEST_USER_ID;
  return renderWithTheme(
    <AuthProvider client={createFakeAuthClient(fakeSession()).client}>
      <ProfileProvider
        userId={userId}
        repo={options.profileRepo ?? createFakeProfileRepo().repo}
        cache={options.profileCache ?? createMemoryCache<ProfileRow>().cache}>
        <KeysProvider
          userId={userId}
          repo={options.keysRepo ?? createFakeKeysRepo().repo}
          cache={options.keysCache ?? createMemoryCache<CachedKeys>().cache}>
          <HistoryProvider
            userId={userId}
            repo={options.historyRepo ?? createFakeHistoryRepo().repo}
            outboxCache={options.outboxCache ?? createMemoryCache<QueuedEntry[]>().cache}
            peopleCache={options.peopleCache ?? createMemoryCache<PersonRow[]>().cache}>
            <PromptsProvider
              userId={userId}
              repo={options.promptsRepo ?? createFakePromptsRepo().repo}
              cache={options.promptsCache ?? createMemoryCache<CachedPrompts>().cache}>
              {element}
            </PromptsProvider>
          </HistoryProvider>
        </KeysProvider>
      </ProfileProvider>
    </AuthProvider>,
  );
}
