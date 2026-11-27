import type { ProviderId } from '@/lib/database.types';

export type ModeId = 'story_reply' | 'opener' | 'reply' | 'analyse';
export type ContextId = 'stranger' | 'mutual_follow' | 'know_her' | 'already_talking';
export type ScreenType = 'story' | 'profile' | 'chat' | 'other';
export type Interest = 'high' | 'medium' | 'low' | 'unclear';
export type Adjustment = 'new_lines' | 'shorter' | 'bolder';
/** Where the sender wants a chat to go next (Reply only). */
export type Direction = 'keep_going' | 'heat_up' | 'ask_out';
/** Why the sender did not like a line. */
export type LineFeedback = 'too_much' | 'too_tame' | 'cringe' | 'not_me' | 'too_long' | 'generic';
/** What a chat screenshot shows about the last line the sender used. */
export type SentLineStatus = 'replied' | 'no_reply' | 'unknown';

/** A screenshot ready to send: already resized, as base64 without any "data:" prefix. */
export type ImageInput = {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
};

/** Fixed rules and output format. Same for every user; only the owner edits them. */
export type PromptCore = {
  version: number;
  rules: string;
  outputFormat: string;
};

/** What the sender has told Banter about himself. Every field is optional. */
export type SenderProfile = {
  name?: string | null;
  age?: number | null;
  city?: string | null;
  work?: string | null;
  interests?: string | null;
  textingStyle?: string | null;
  /** What he wants from the app, in his own words. */
  goal?: string | null;
};

/** One earlier interaction with the same person, newest first in the list. */
export type MemoryItem = {
  /** ISO date and time. */
  at: string;
  modeLabel: string;
  toneLabel?: string | null;
  /**
   * True for a set written a moment ago for the screenshot now being worked on. The sender
   * is still choosing between these: none of them counts as sent, whatever was copied.
   */
  sameScreenshot?: boolean;
  lines: {
    text: string;
    copied: boolean;
    result?: 'replied' | 'no_reply' | null;
    /** True for the one line the model is asked to look for in a chat screenshot. */
    awaitingReply?: boolean;
  }[];
};

/** Everything that goes into one prompt (PLAN.md section 6). */
export type PromptInput = {
  core: PromptCore;
  mode: ModeId;
  /** The mode's instruction: the default, or the user's own version. */
  modeInstruction: string;
  /** Not used for Analyse. */
  tone?: { label: string; definition: string } | null;
  context?: ContextId | null;
  /** The sender's own note about her and where things stand ("close friend, she flirts back"). */
  aboutHer?: string | null;
  profile?: SenderProfile | null;
  /** Up to the last five interactions with this person. */
  memory?: MemoryItem[];
  /**
   * For "New lines", "Shorter" and "Bolder": the lines being adjusted. `fix`: the line he
   * marked as not for him, and why, when the adjustment is to fix that.
   */
  adjustment?: {
    kind: Adjustment;
    previousLines: string[];
    fix?: { line: string; reason: LineFeedback } | null;
  } | null;
  /** Reply only: where he wants the chat to go. Left out, or keep_going, means as usual. */
  direction?: Direction | null;
  /** Lines he chose before, with anyone, best first: his taste and voice. */
  likedLines?: string[];
  /** Lines he marked as not for him, and why. */
  dislikedLines?: { text: string; reason: LineFeedback }[];
  /** How lines in the chosen tone have landed with him lately: his reasons, counted. */
  toneMarks?: { reason: LineFeedback; count: number }[];
};

export type BuiltPrompt = {
  /** Sent as the system prompt. Stable across requests. */
  system: string;
  /** Sent with the screenshot. Changes per request. */
  user: string;
};

export type Line = {
  text: string;
  /** The detail in the screenshot the line hooks to. */
  hook: string;
};

type OutputBase = {
  /** Instagram username read from the screenshot, or null when it could not be read. */
  username: string | null;
  screenType: ScreenType;
  noticed: string;
  /**
   * Whether the chat in the screenshot shows a reply to the last line the sender used
   * with this person. 'unknown' unless the screenshot is a chat that shows that line.
   */
  sentLineStatus: SentLineStatus;
};

export type LinesOutput = OutputBase & {
  kind: 'lines';
  lines: Line[];
  /** When asked where to take a chat: where it stands now, in a sentence or two. */
  read?: string | null;
};

export type AnalysisOutput = OutputBase & {
  kind: 'analysis';
  interest: Interest;
  signals: string[];
  advice: string;
  /** Null when the advice is to leave it. */
  suggestedReply: string | null;
};

/** The model followed one of the stop conditions in the core rules and wrote no lines. */
export type DeclinedOutput = OutputBase & { kind: 'declined'; reason: string };

export type ModelOutput = LinesOutput | AnalysisOutput | DeclinedOutput;

/** One of the user's keys, ready to try. */
export type KeyCandidate = {
  id: string;
  label: string;
  provider: ProviderId;
  key: string;
  model: string;
};

export type GenerationResult = {
  output: ModelOutput;
  usedKey: Pick<KeyCandidate, 'id' | 'label' | 'provider' | 'model'>;
  promptVersion: number;
  durationMs: number;
};
