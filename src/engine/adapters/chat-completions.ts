import type { ProviderId } from '@/lib/database.types';

import { EngineError } from '../errors';

import { postJson, requestImages, throwForStatus, type Adapter, type AdapterRequest } from './http';

type Setup = {
  provider: ProviderId;
  url: string;
  /** Fields this provider needs on top of the common ones. */
  extra?: (request: AdapterRequest) => Record<string, unknown>;
};

type Choice = {
  finish_reason?: string | null;
  error?: { code?: unknown; message?: unknown } | null;
  message?: { content?: unknown; refusal?: unknown } | null;
};

/** The answer text. Some providers send a list of parts instead of one string. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (part as { text?: unknown })?.text)
    .filter((text): text is string => typeof text === 'string')
    .join('');
}

/**
 * Providers that speak OpenAI's older Chat Completions format: OpenRouter and Groq.
 * One request shape for all of them: the system prompt, then the task with the screenshot,
 * and a strict JSON schema for the answer. Nothing else is sent: these providers reject
 * fields they do not know, and sampling settings stay at the model's own.
 */
export function chatCompletionsAdapter({ provider, url, extra }: Setup): Adapter {
  return async (request) => {
    const posted = await postJson(
      url,
      { Authorization: `Bearer ${request.key}` },
      {
        model: request.model,
        messages: [
          { role: 'system', content: request.system },
          {
            role: 'user',
            content: [
              { type: 'text', text: request.user },
              ...requestImages(request).map((image) => ({
                type: 'image_url',
                image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
              })),
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: request.schema.name, strict: true, schema: request.schema.schema },
        },
        ...extra?.(request),
      },
      request,
    );
    throwForStatus(provider, posted);

    const body = posted.body as { error?: { code?: unknown }; choices?: Choice[] } | null;

    // OpenRouter can answer 200 and still report a failure in the body.
    if (body?.error) {
      const code = typeof body.error.code === 'number' && body.error.code >= 400 ? body.error.code : 502;
      throwForStatus(provider, { status: code, body });
    }
    const choice = body?.choices?.[0];
    if (!choice) throw new EngineError('unreadable', { detail: `${provider} returned no choices` });
    if (choice.error || choice.finish_reason === 'error') {
      throw new EngineError('provider_down', { detail: `${provider} failed mid-answer: ${JSON.stringify(choice.error)}` });
    }

    const refusal = choice.message?.refusal;
    if ((typeof refusal === 'string' && refusal.trim()) || choice.finish_reason === 'content_filter') {
      throw new EngineError('refused', { detail: `${provider} refusal: ${String(refusal ?? choice.finish_reason)}` });
    }
    if (choice.finish_reason === 'length') {
      throw new EngineError('unreadable', { detail: `${provider} stopped at the length limit` });
    }

    // A thinking model may put its reasoning first, in <think> tags. Only the answer counts.
    const text = contentText(choice.message?.content)
      .replace(/^\s*<think>[\s\S]*?<\/think>/, '')
      .trim();
    if (!text) throw new EngineError('unreadable', { detail: `${provider} returned no text` });
    return text;
  };
}

/**
 * OpenRouter. `require_parameters` sends the request only to hosts that honour the JSON
 * schema; without it a host that ignores the schema could answer in free text.
 */
export const openrouterAdapter = chatCompletionsAdapter({
  provider: 'openrouter',
  url: 'https://openrouter.ai/api/v1/chat/completions',
  extra: () => ({ provider: { require_parameters: true } }),
});

/**
 * Groq. Its Qwen models think before answering; `hidden` keeps that out of the answer
 * (the default puts it in the text, which Groq refuses together with a JSON schema).
 */
export const groqAdapter = chatCompletionsAdapter({
  provider: 'groq',
  url: 'https://api.groq.com/openai/v1/chat/completions',
  extra: ({ model }) => (model.startsWith('qwen/') ? { reasoning_format: 'hidden' } : {}),
});
