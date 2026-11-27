import { SCREENSHOT_BUCKET } from '@/history/history-repo';
import type { FeedbackInsert } from '@/lib/database.types';
import type { BanterClient } from '@/lib/supabase';

/** A ticket to send. The id is made by the app, so its files can be named after it. */
export type NewTicket = FeedbackInsert & { id: string };

/**
 * The files a ticket carries, each a resized JPEG as base64: the screenshot of the reported
 * set (the copy the AI saw), and pictures the user added.
 */
export type TicketFiles = { userId: string; screenshot: string | null; pictures: string[] };

/** How many pictures a ticket can carry (the database allows no more). */
export const MAX_PICTURES = 3;

export type FeedbackRepo = {
  /** Uploads the ticket's files, then saves the ticket. Throws on failure. */
  send: (ticket: NewTicket, files?: TicketFiles | null) => Promise<void>;
};

function bytesOf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function createFeedbackRepo(client: BanterClient): FeedbackRepo {
  // In the user's own folder, like every screenshot; an admin may open the files because
  // the ticket points to them.
  const upload = async (path: string, base64: string): Promise<string> => {
    const { error } = await client.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, bytesOf(base64), { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    return path;
  };

  return {
    async send(ticket, files) {
      const folder = files?.userId;
      const screenshotPath =
        folder && files.screenshot ? await upload(`${folder}/feedback-${ticket.id}.jpg`, files.screenshot) : null;
      const pictures = folder
        ? await Promise.all(
            files.pictures
              .slice(0, MAX_PICTURES)
              .map((picture, index) => upload(`${folder}/feedback-${ticket.id}-${index + 1}.jpg`, picture)),
          )
        : [];
      const { error } = await client.from('feedback').insert({
        ...ticket,
        screenshot_path: screenshotPath,
        // Left out when there are none, so a ticket without pictures is the same as before.
        ...(pictures.length > 0 ? { pictures } : {}),
      });
      if (error) throw error;
    },
  };
}
