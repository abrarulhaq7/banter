import { EngineError } from './errors';
import type { Interest, Line, ModeId, ModelOutput, ScreenType, SentLineStatus } from './types';

/**
 * The fixed answer structure, and the checking that turns a model's text into it.
 *
 * The structure lives in the app, not in the database, so a prompt edit can never break
 * what the app reads. The schemas avoid everything the three providers disagree on: every
 * field is required, there are no nulls (an empty string means "none"), and no length or
 * count limits. Limits are applied here instead, after the answer arrives.
 */

export type AnswerSchema = { name: string; schema: Record<string, unknown> };

const SHARED_PROPERTIES = {
  username: { type: 'string' },
  screen_type: { type: 'string', enum: ['story', 'profile', 'chat', 'other'] },
  noticed: { type: 'string' },
  refusal: { type: 'string' },
  sent_line_status: { type: 'string', enum: ['replied', 'no_reply', 'unknown'] },
} as const;

const SHARED_REQUIRED = ['username', 'screen_type', 'noticed', 'refusal', 'sent_line_status'];

const LINES_SCHEMA: AnswerSchema = {
  name: 'banter_lines',
  schema: {
    type: 'object',
    properties: {
      ...SHARED_PROPERTIES,
      read: { type: 'string' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' }, hook: { type: 'string' } },
          required: ['text', 'hook'],
          additionalProperties: false,
        },
      },
    },
    required: [...SHARED_REQUIRED, 'read', 'lines'],
    additionalProperties: false,
  },
};

const ANALYSIS_SCHEMA: AnswerSchema = {
  name: 'banter_analysis',
  schema: {
    type: 'object',
    properties: {
      ...SHARED_PROPERTIES,
      interest: { type: 'string', enum: ['high', 'medium', 'low', 'unclear'] },
      signals: { type: 'array', items: { type: 'string' } },
      advice: { type: 'string' },
      suggested_reply: { type: 'string' },
    },
    required: [...SHARED_REQUIRED, 'interest', 'signals', 'advice', 'suggested_reply'],
    additionalProperties: false,
  },
};

export function schemaFor(mode: ModeId): AnswerSchema {
  return mode === 'analyse' ? ANALYSIS_SCHEMA : LINES_SCHEMA;
}

export const MAX_LINES = 3;
const MAX_SIGNALS = 5;

const SCREEN_TYPES: readonly ScreenType[] = ['story', 'profile', 'chat', 'other'];
const INTERESTS: readonly Interest[] = ['high', 'medium', 'low', 'unclear'];
const SENT_LINE_STATUSES: readonly SentLineStatus[] = ['replied', 'no_reply', 'unknown'];

function unreadable(detail: string): EngineError {
  return new EngineError('unreadable', { detail });
}

/** Finds the JSON object in a model's text, even when it is wrapped in a code block or prose. */
function extractObject(text: string): Record<string, unknown> {
  const candidates = [text.trim()];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced) candidates.push(fenced[1].trim());
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    } catch {
      // Try the next way of finding it.
    }
  }
  throw unreadable('The answer is not a JSON object.');
}

function text(value: unknown, limit = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

/** A message as it would be sent: no wrapping quotes the model may have added. */
function messageText(value: unknown): string {
  return text(value)
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim();
}

/** Instagram username: lowercase, no "@". Null when it is not a possible username. */
export function cleanUsername(value: unknown): string | null {
  const username = text(value, 60).replace(/^@+/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(username) ? username : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const found = allowed.find((item) => item === text(value).toLowerCase());
  return found ?? fallback;
}

/**
 * Turns the model's text into a checked answer, repairing what can be repaired:
 * extra lines are dropped, blanks and duplicates removed, bad values replaced by safe ones.
 * Throws EngineError('unreadable') when there is nothing usable.
 */
export function parseModelOutput(mode: ModeId, raw: string): ModelOutput {
  const data = extractObject(raw);

  const base = {
    username: cleanUsername(data.username),
    screenType: oneOf(data.screen_type, SCREEN_TYPES, 'other'),
    noticed: text(data.noticed),
    sentLineStatus: oneOf(data.sent_line_status, SENT_LINE_STATUSES, 'unknown'),
  };

  const refusal = text(data.refusal, 500);
  if (refusal) return { ...base, kind: 'declined', reason: refusal };

  if (mode === 'analyse') {
    const advice = text(data.advice, 1000);
    if (!advice) throw unreadable('The analysis has no advice.');
    const signals = Array.isArray(data.signals)
      ? data.signals.map((signal) => text(signal, 300)).filter(Boolean).slice(0, MAX_SIGNALS)
      : [];
    return {
      ...base,
      kind: 'analysis',
      interest: oneOf(data.interest, INTERESTS, 'unclear'),
      signals,
      advice,
      suggestedReply: messageText(data.suggested_reply) || null,
    };
  }

  const seen = new Set<string>();
  const lines: Line[] = [];
  for (const item of Array.isArray(data.lines) ? data.lines : []) {
    const entry = (item ?? {}) as { text?: unknown; hook?: unknown };
    const message = messageText(entry.text);
    const key = message.toLowerCase();
    if (!message || seen.has(key)) continue;
    seen.add(key);
    lines.push({ text: message, hook: text(entry.hook, 500) });
    if (lines.length === MAX_LINES) break;
  }
  if (lines.length === 0) throw unreadable('The answer has no lines and no refusal.');
  const read = text(data.read, 400);
  return { ...base, kind: 'lines', lines, ...(read ? { read } : {}) };
}
