import type { ProviderId } from '@/lib/database.types';

import { claudeAdapter } from './claude';
import { geminiAdapter } from './gemini';
import type { Adapter } from './http';
import { openaiAdapter } from './openai';

export type { Adapter, AdapterRequest } from './http';

export const ADAPTERS: Record<ProviderId, Adapter> = {
  claude: claudeAdapter,
  openai: openaiAdapter,
  gemini: geminiAdapter,
};
