import { EngineError } from '../errors';

import { postJson, throwForStatus, type Adapter } from './http';

/** OpenAI, through the Responses API. */
export const openaiAdapter: Adapter = async (request) => {
  const posted = await postJson(
    'https://api.openai.com/v1/responses',
    { Authorization: `Bearer ${request.key}` },
    {
      model: request.model,
      // OpenAI keeps a copy of each request by default. Screenshots show other people, so no.
      store: false,
      input: [
        { role: 'system', content: request.system },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: request.user },
            {
              type: 'input_image',
              image_url: `data:${request.image.mediaType};base64,${request.image.base64}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: request.schema.name,
          schema: request.schema.schema,
          strict: true,
        },
      },
    },
    request,
  );
  throwForStatus('openai', posted);

  const body = posted.body as {
    status?: string;
    incomplete_details?: { reason?: string };
    output?: { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[];
  };

  const parts = (body?.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? []);

  if (parts.some((part) => part.type === 'refusal')) {
    throw new EngineError('refused', { detail: 'openai refusal' });
  }
  if (body?.status === 'incomplete') {
    throw new EngineError('unreadable', {
      detail: `openai incomplete: ${body.incomplete_details?.reason ?? 'no reason'}`,
    });
  }
  const text = parts.find((part) => part.type === 'output_text')?.text;
  if (!text) throw new EngineError('unreadable', { detail: 'openai returned no text' });
  return text;
};
