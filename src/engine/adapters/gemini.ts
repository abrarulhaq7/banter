import { EngineError } from '../errors';

import { postJson, throwForStatus, type Adapter } from './http';

/** Gemini, through the Interactions API. */
export const geminiAdapter: Adapter = async (request) => {
  const posted = await postJson(
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    { 'x-goog-api-key': request.key, 'Api-Revision': '2026-05-20' },
    {
      model: request.model,
      // Google keeps a copy of each request by default. Screenshots show other people, so no.
      store: false,
      system_instruction: request.system,
      input: [
        { type: 'text', text: request.user },
        ...(request.image
          ? [{ type: 'image', data: request.image.base64, mime_type: request.image.mediaType }]
          : []),
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: request.schema.schema,
      },
    },
    request,
  );
  throwForStatus('gemini', posted);

  const body = posted.body as {
    status?: string;
    steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };

  const text = (body?.steps ?? [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');

  if (body?.status === 'incomplete') {
    throw new EngineError('unreadable', { detail: 'gemini incomplete answer' });
  }
  if (!text) {
    // Gemini gives no text when its safety system blocks an answer.
    throw new EngineError(body?.status === 'failed' ? 'provider_down' : 'refused', {
      detail: `gemini returned no text (status ${body?.status ?? 'unknown'})`,
    });
  }
  return text;
};
