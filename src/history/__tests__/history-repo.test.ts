import { createHistoryRepo } from '@/history';
import type { InteractionInsert } from '@/lib/database.types';
import type { BanterClient } from '@/lib/supabase';

type Answer = { error: { code: string; message: string; details?: string } | null };

/** A Supabase client that answers each interactions upsert from the list, and records them. */
function fakeClient(answers: Answer[]) {
  const sent: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      upsert: async (row: Record<string, unknown>) => {
        sent.push(row);
        return answers[Math.min(sent.length - 1, answers.length - 1)];
      },
    }),
  } as unknown as BanterClient;
  return { client, sent };
}

const row = {
  id: 'i1',
  person_id: null,
  tone_id: 'spicy',
  user_prompt_id: 'prompt-1',
  tone_label: 'Spicy',
} as unknown as InteractionInsert;

const missing = (constraint: string, details: string): Answer => ({
  error: { code: '23503', message: `insert or update on table "interactions" violates foreign key constraint "${constraint}"`, details },
});

describe('saving an interaction whose tone is missing', () => {
  it('saves the lines without the link to a tone Supabase does not have yet, keeping its name', async () => {
    const { client, sent } = fakeClient([
      missing('interactions_tone_id_fkey', 'Key (tone_id)=(spicy) is not present in table "tones".'),
      { error: null },
    ]);

    await createHistoryRepo(client).saveInteraction({ ...row, user_prompt_id: null });

    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ tone_id: null, tone_label: 'Spicy' });
  });

  it('drops both links when both are missing, one at a time', async () => {
    const { client, sent } = fakeClient([
      missing('interactions_user_prompt_id_user_id_fkey', 'Key (user_prompt_id, user_id)=(prompt-1, u) is not present in table "user_prompts".'),
      missing('interactions_tone_id_fkey', 'Key (tone_id)=(spicy) is not present in table "tones".'),
      { error: null },
    ]);

    await createHistoryRepo(client).saveInteraction(row);

    expect(sent.map((item) => [item.user_prompt_id, item.tone_id])).toEqual([
      ['prompt-1', 'spicy'],
      [null, 'spicy'],
      [null, null],
    ]);
  });

  it('still fails on any other problem', async () => {
    const { client } = fakeClient([{ error: { code: '23514', message: 'violates check constraint' } }]);

    await expect(createHistoryRepo(client).saveInteraction(row)).rejects.toMatchObject({ code: '23514' });
  });

  it('still fails when a link it cannot drop is missing', async () => {
    const { client } = fakeClient([missing('interactions_person_id_user_id_fkey', 'Key (person_id)=(p) is not present.')]);

    await expect(createHistoryRepo(client).saveInteraction(row)).rejects.toMatchObject({ code: '23503' });
  });
});
