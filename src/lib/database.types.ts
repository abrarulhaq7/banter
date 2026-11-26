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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
