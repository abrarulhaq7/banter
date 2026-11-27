/**
 * Types for the tables the app reads and writes. Written by hand to match
 * supabase/migrations; update both together. Tables are added here as phases need them.
 */

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'openai' | 'claude';
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
  /** Null means automatic: the provider's best model first, then the next. */
  model: string | null;
  sort_order: number;
  status: KeyStatus;
  last_error: string | null;
  limited_at: string | null;
  /**
   * Models of this key that hit their limit, and until when to leave them alone:
   * `{ "model id": "ISO time" }`. Missing in copies saved before it existed.
   */
  model_limits?: ModelLimits;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelLimits = Record<string, string>;

export type ModelRow = {
  provider: ProviderId;
  model_id: string;
  label: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  /**
   * Quality order across all providers: 1 is the best. Banter tries the best model first.
   * Null (or missing in an old saved copy) goes last.
   */
  rank?: number | null;
  created_at: string;
  updated_at: string;
};

/** The fixed rules every prompt starts with. One row is active. Only the owner edits it. */
export type PromptCoreRow = {
  version: number;
  rules: string;
  output_format: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type ModeRow = {
  id: string;
  label: string;
  instruction: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ToneRow = {
  id: string;
  label: string;
  definition: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * A user's own version of a default tone (tone_id set), or a tone they made themselves
 * (tone_id and mode_id both null, label set).
 */
export type UserPromptRow = {
  id: string;
  user_id: string;
  tone_id: string | null;
  mode_id: string | null;
  label: string | null;
  content: string;
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

export type LineFeedbackId = 'too_much' | 'too_tame' | 'cringe' | 'not_me' | 'too_long' | 'generic';

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
  /** Why the user did not like the line. Missing on databases without the column yet. */
  feedback?: LineFeedbackId | null;
  /** When the user liked the line ("more like this"). Never set together with feedback. */
  liked_at?: string | null;
  created_at: string;
};

/** What the app sends when it saves a generation. user_id is filled in by the database. */
export type InteractionInsert = Omit<InteractionRow, 'user_id' | 'user_prompt_id' | 'created_at'> & {
  /** The user's own version of the tone, or their custom tone, when one was used. */
  user_prompt_id?: string | null;
  created_at?: string;
};
export type LineInsert = Pick<LineRow, 'id' | 'interaction_id' | 'position' | 'text' | 'hook'> &
  Partial<Pick<LineRow, 'copied_at' | 'kept_at' | 'result' | 'result_at'>>;
export type LinePatch = Partial<
  Pick<LineRow, 'copied_at' | 'kept_at' | 'result' | 'result_at' | 'feedback' | 'liked_at'>
>;

/** One row of the usage view: generations made with one key on one model. */
export type UsageRow = {
  provider: ProviderId;
  model: string;
  /** The key's name at the time. Null when none was recorded. */
  key_label: string | null;
  generations: number;
  this_month: number;
  last_used_at: string | null;
};

/** What the app keeps in `profiles.settings`. Every field is optional. */
export type ProfileSettings = {
  /** False when the user turned off saving screenshots. Anything else means save them. */
  save_screenshots?: boolean;
  /** The language lines are written in. Missing means English. */
  reply_language?: 'english' | 'roman_urdu';
  /** What the user wants from Banter, in their own words (About you). Used in prompts. */
  goal?: string;
  /** Tones (by `Tone.key`) the user hid from the Generate screen. Everything else shows. */
  hidden_tones?: string[];
};

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
            | 'label'
            | 'model'
            | 'sort_order'
            | 'status'
            | 'last_error'
            | 'limited_at'
            | 'last_used_at'
            | 'model_limits'
          >
        >
      >;
      models: Table<ModelRow, never, never>;
      prompt_core: Table<PromptCoreRow, never, never>;
      modes: Table<ModeRow, never, never>;
      tones: Table<ToneRow, never, never>;
      user_prompts: Table<
        UserPromptRow,
        Pick<UserPromptRow, 'content'> & Partial<Pick<UserPromptRow, 'tone_id' | 'label'>>,
        Partial<Pick<UserPromptRow, 'label' | 'content'>>
      >;
      people: Table<
        PersonRow,
        Pick<PersonRow, 'username'> & Partial<Pick<PersonRow, 'id' | 'context' | 'last_interaction_at'>>,
        Partial<Pick<PersonRow, 'username' | 'context' | 'notes' | 'last_interaction_at'>>
      >;
      interactions: Table<InteractionRow, InteractionInsert, Partial<InteractionInsert>>;
      lines: Table<LineRow, LineInsert, LinePatch>;
    };
    Views: {
      usage_summary: { Row: UsageRow & { user_id: string }; Relationships: [] };
    };
    Functions: {
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
