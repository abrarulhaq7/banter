import type { ProviderId } from '@/lib/database.types';

export const PROVIDER_IDS: readonly ProviderId[] = ['gemini', 'openai', 'claude'];

type ProviderInfo = {
  label: string;
  /** Where the user creates a key, shown as plain text. */
  keyPage: string;
  /** How this provider's keys usually start. Used only for a gentle hint, never to block. */
  keyPrefix: string;
};

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: { label: 'Gemini', keyPage: 'aistudio.google.com/apikey', keyPrefix: 'AIza' },
  openai: { label: 'OpenAI', keyPage: 'platform.openai.com/api-keys', keyPrefix: 'sk-' },
  claude: { label: 'Claude', keyPage: 'platform.claude.com/settings/keys', keyPrefix: 'sk-ant-' },
};

/**
 * Guesses the provider from how a key starts, or null when it is not clear.
 * Claude is checked before OpenAI because "sk-ant-" also starts with "sk-".
 */
export function guessProvider(key: string): ProviderId | null {
  const value = key.trim();
  if (value.startsWith(PROVIDERS.claude.keyPrefix)) return 'claude';
  if (value.startsWith(PROVIDERS.openai.keyPrefix)) return 'openai';
  if (value.startsWith(PROVIDERS.gemini.keyPrefix)) return 'gemini';
  return null;
}

/** Shows only the end of a key, for lists: "••••••••abcd". */
export function maskKey(key: string): string {
  const tail = key.length > 8 ? key.slice(-4) : '';
  return `••••••••${tail}`;
}
