/**
 * Types for the tables the app reads and writes. Written by hand to match
 * supabase/migrations; update both together. Tables are added here as phases need them.
 */

export type ProviderId = 'gemini' | 'openai' | 'claude';
export type KeyStatus = 'active' | 'limited' | 'invalid' | 'disabled';
export type ThemeId = 'midnightPlum' | 'ember' | 'deepSea';

export type ProfileRow = {
  id: string;
  display_name: string | null;
  age: number | null;
  city: string | null;
  work: string | null;
  interests: string | null;
  texting_style: string | null;
  theme: ThemeId;
  settings: Record<string, unknown>;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiKeyRow = {
  id: string;
  user_id: string;
  provider: ProviderId;
  label: string;
  key: string;
  /** Null means "use the provider's default model". */
  model: string | null;
  sort_order: number;
  status: KeyStatus;
  last_error: string | null;
  limited_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelRow = {
  provider: ProviderId;
  model_id: string;
  label: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ContextId = 'stranger' | 'mutual_follow' | 'know_her' | 'already_talking';
export type LineResult = 'replied' | 'no_reply';

export type PersonRow = {
  id: string;
  user_id: string;
  /** Instagram username: lowercase, no "@". */
  username: string;
  context: ContextId | null;
  notes: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InteractionRow = {
  id: string;
  user_id: string;
  person_id: string | null;
  parent_id: string | null;
  adjustment: 'new_lines' | 'shorter' | 'bolder' | null;
  mode_id: string;
  tone_id: string | null;
  user_prompt_id: string | null;
  tone_label: string | null;
  context: ContextId | null;
  screenshot_path: string | null;
  screen_type: 'story' | 'profile' | 'chat' | 'other' | null;
  noticed: string | null;
  analysis: Record<string, unknown> | null;
  provider: ProviderId;
  model: string;
  api_key_id: string | null;
  api_key_label: string | null;
  prompt_version: number | null;
  duration_ms: number | null;
  created_at: string;
};

export type LineRow = {
  id: string;
  user_id: string;
  interaction_id: string;
  position: number;
  text: string;
  hook: string | null;
  copied_at: string | null;
  kept_at: string | null;
  result: LineResult | null;
  result_at: string | null;
  created_at: string;
};

/** What the app sends when it saves a generation. user_id is filled in by the database. */
export type InteractionInsert = Omit<InteractionRow, 'user_id' | 'user_prompt_id' | 'created_at'> & {
  created_at?: string;
};
export type LineInsert = Pick<LineRow, 'id' | 'interaction_id' | 'position' | 'text' | 'hook'> &
  Partial<Pick<LineRow, 'copied_at' | 'kept_at' | 'result' | 'result_at'>>;
export type LinePatch = Partial<Pick<LineRow, 'copied_at' | 'kept_at' | 'result' | 'result_at'>>;

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        never,
        Partial<Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>>
      >;
      api_keys: Table<
        ApiKeyRow,
        Pick<ApiKeyRow, 'provider' | 'label' | 'key'> &
          Partial<Pick<ApiKeyRow, 'model' | 'sort_order' | 'status'>>,
        Partial<
          Pick<
            ApiKeyRow,
            'label' | 'model' | 'sort_order' | 'status' | 'last_error' | 'limited_at' | 'last_used_at'
          >
        >
      >;
      models: Table<ModelRow, never, never>;
      people: Table<
        PersonRow,
        Pick<PersonRow, 'username'> & Partial<Pick<PersonRow, 'id' | 'context' | 'last_interaction_at'>>,
        Partial<Pick<PersonRow, 'username' | 'context' | 'notes' | 'last_interaction_at'>>
      >;
      interactions: Table<InteractionRow, InteractionInsert, Partial<InteractionInsert>>;
      lines: Table<LineRow, LineInsert, LinePatch>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
