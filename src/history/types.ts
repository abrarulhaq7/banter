import type { ContextId, InteractionInsert, LineInsert, LinePatch } from '@/lib/database.types';

/**
 * Everything the app saves to history goes through a queue kept on the phone (the
 * outbox), so nothing is lost without internet. These are the kinds of entry in it.
 * Row ids are made on the phone, so sending an entry twice is harmless.
 */

/** One generation: who it was for, the interaction, its lines and the screenshot. */
export type GenerationEntry = {
  kind: 'generation';
  /** Null when the username could not be read. The interaction is saved without a person. */
  username: string | null;
  context: ContextId | null;
  /** Everything except person_id, which is looked up from the username when sending. */
  interaction: Omit<InteractionInsert, 'person_id'>;
  lines: LineInsert[];
  /** The resized file on the phone, uploaded if the screenshot is not in storage yet. */
  screenshot: { path: string; localUri: string } | null;
};

/** A line was copied, kept or un-kept, or its result was marked. */
export type LinePatchEntry = {
  kind: 'linePatch';
  lineId: string;
  patch: LinePatch;
};

/** The user corrected the username: move these interactions to that person. */
export type AssignPersonEntry = {
  kind: 'assignPerson';
  interactionIds: string[];
  username: string;
  context: ContextId | null;
  /** The username they were saved under before, if any. Removed if nothing is left under it. */
  previousUsername?: string | null;
};

/** The user changed how they know someone. */
export type PersonContextEntry = {
  kind: 'personContext';
  username: string;
  context: ContextId;
};

export type OutboxEntry = GenerationEntry | LinePatchEntry | AssignPersonEntry | PersonContextEntry;

export type QueuedEntry = OutboxEntry & {
  /** Id of the queue entry itself. */
  entryId: string;
  queuedAt: string;
};
