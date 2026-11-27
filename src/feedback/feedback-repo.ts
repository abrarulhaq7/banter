import { SCREENSHOT_BUCKET } from '@/history/history-repo';
import type { FeedbackInsert } from '@/lib/database.types';
import type { BanterClient } from '@/lib/supabase';

/** A ticket to send. The id is made by the app, so the screenshot can be named after it. */
export type NewTicket = FeedbackInsert & { id: string };

/** The screenshot a ticket is about: the resized copy the AI saw, as base64. */
export type TicketScreenshot = { userId: string; base64: string };

export type FeedbackRepo = {
  /** Uploads the screenshot when there is one, then saves the ticket. Throws on failure. */
  send: (ticket: NewTicket, screenshot?: TicketScreenshot | null) => Promise<void>;
};

function bytesOf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function createFeedbackRepo(client: BanterClient): FeedbackRepo {
  return {
    async send(ticket, screenshot) {
      let screenshotPath: string | null = null;
      if (screenshot) {
        // In the user's own folder, like every screenshot; an admin may open it because
        // a ticket points to it.
        screenshotPath = `${screenshot.userId}/feedback-${ticket.id}.jpg`;
        const { error } = await client.storage
          .from(SCREENSHOT_BUCKET)
          .upload(screenshotPath, bytesOf(screenshot.base64), { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }
      const { error } = await client.from('feedback').insert({ ...ticket, screenshot_path: screenshotPath });
      if (error) throw error;
    },
  };
}
