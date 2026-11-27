import { getSupabase } from '@/lib/supabase';

import { createFeedbackRepo, type FeedbackRepo } from './feedback-repo';

/** Sends a ticket with its files to Supabase: what the feedback screen and a line's report use. */
export const sendFeedback: FeedbackRepo['send'] = (ticket, files) => {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not connected');
  return createFeedbackRepo(client).send(ticket, files);
};
