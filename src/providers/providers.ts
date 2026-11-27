import type { ProviderId } from '@/lib/database.types';

/** In the order the picker shows them: the ones with a free tier first. */
export const PROVIDER_IDS: readonly ProviderId[] = ['gemini', 'groq', 'openrouter', 'openai', 'claude'];

type ProviderInfo = {
  label: string;
  /** Where the user creates a key, shown as plain text. */
  keyPage: string;
  /** How this provider's keys usually start. Used only for a gentle hint, never to block. */
  keyPrefix: string;
  /** One short line for the picker: what using it costs. */
  cost: string;
};

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    label: 'Gemini',
    keyPage: 'aistudio.google.com/apikey',
    keyPrefix: 'AIza',
    cost: 'Free tier, a few hundred a day',
  },
  groq: { label: 'Groq', keyPage: 'console.groq.com/keys', keyPrefix: 'gsk_', cost: 'Free tier, very fast' },
  openrouter: {
    label: 'OpenRouter',
    keyPage: 'openrouter.ai/settings/keys',
    keyPrefix: 'sk-or-',
    cost: 'Free models, 50 a day (1,000 after a $10 top-up)',
  },
  openai: { label: 'OpenAI', keyPage: 'platform.openai.com/api-keys', keyPrefix: 'sk-', cost: 'Paid' },
  claude: { label: 'Claude', keyPage: 'platform.claude.com/settings/keys', keyPrefix: 'sk-ant-', cost: 'Paid' },
};

/**
 * Guesses the provider from how a key starts, or null when it is not clear.
 * Claude and OpenRouter are checked before OpenAI: their keys also start with "sk-".
 */
export function guessProvider(key: string): ProviderId | null {
  const value = key.trim();
  const order: ProviderId[] = ['claude', 'openrouter', 'openai', 'gemini', 'groq'];
  return order.find((provider) => value.startsWith(PROVIDERS[provider].keyPrefix)) ?? null;
}

/** Shows only the end of a key, for lists: "••••••••abcd". */
export function maskKey(key: string): string {
  const tail = key.length > 8 ? key.slice(-4) : '';
  return `••••••••${tail}`;
}
