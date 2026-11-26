import { EngineError } from '../errors';

import { postJson, throwForStatus, type Adapter } from './http';

/**
 * Claude, through the Messages API with plain requests. Anthropic's SDK is not used
 * because it does not support React Native.
 *
 * Sampling settings such as temperature are not sent: this API version rejects them.
 */
export const claudeAdapter: Adapter = async (request) => {
  const posted = await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': request.key, 'anthropic-version': '2026-10-21' },
    {
      model: request.model,
      // Room for the model's thinking as well as the short answer.
      max_tokens: 16000,
      system: request.system,
      messages: [
        {
          role: 'user',
          content: [
            ...(request.image
              ? [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: request.image.mediaType, data: request.image.base64 },
                  },
                ]
              : []),
            { type: 'text', text: request.user },
          ],
        },
      ],
      output_config: { format: { type: 'json_schema', schema: request.schema.schema } },
    },
    request,
  );
  throwForStatus('claude', posted);

  const body = posted.body as {
    stop_reason?: string;
    stop_details?: { category?: string | null };
    content?: { type?: string; text?: string }[];
  };

  if (body?.stop_reason === 'refusal') {
    throw new EngineError('refused', { detail: `claude refusal: ${body.stop_details?.category ?? 'no category'}` });
  }
  if (body?.stop_reason === 'max_tokens') {
    throw new EngineError('unreadable', { detail: 'claude stopped at max_tokens' });
  }
  const text = body?.content?.find((block) => block.type === 'text')?.text;
  if (!text) throw new EngineError('unreadable', { detail: 'claude returned no text' });
  return text;
};
