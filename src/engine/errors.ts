/**
 * The plain cases every provider problem is mapped to (PLAN.md section 7).
 * Screens show `message`; `detail` is for the developer and is never shown to users.
 */
export type EngineErrorKind =
  /** The provider rejected the key. */
  | 'wrong_key'
  /** Rate limit or spending cap reached. It clears by itself after a while. */
  | 'limit'
  /** The provider account behind the key has no credit. It needs topping up. */
  | 'no_credit'
  | 'no_internet'
  /** The provider's safety system declined the request. */
  | 'refused'
  /** The model answered, but not in a form Banter can use. */
  | 'unreadable'
  /** The provider is having trouble (5xx). */
  | 'provider_down'
  /** The provider did not accept the request, for example an unknown model. */
  | 'bad_request'
  /** The user has no key that can be used. */
  | 'no_keys';

const MESSAGES: Record<EngineErrorKind, string> = {
  wrong_key: 'This key was rejected. Check it on the Keys screen.',
  limit: 'This key has reached its limit.',
  no_credit: 'This key has no credit left. Add credit with the provider, then try again.',
  no_internet: 'No connection. Check your internet and try again.',
  refused: 'The AI declined to answer for this screenshot.',
  unreadable: 'The AI gave an answer Banter could not read. Try again.',
  provider_down: 'The AI provider is having trouble right now. Try again in a moment.',
  bad_request: 'The AI provider did not accept the request.',
  no_keys: 'Add an AI key to start.',
};

export class EngineError extends Error {
  readonly kind: EngineErrorKind;
  /** Extra information for the developer. Never contains a key. */
  readonly detail?: string;

  constructor(kind: EngineErrorKind, options: { message?: string; detail?: string } = {}) {
    super(options.message ?? MESSAGES[kind]);
    this.name = 'EngineError';
    this.kind = kind;
    this.detail = options.detail;
  }
}

export function isEngineError(value: unknown): value is EngineError {
  return value instanceof EngineError;
}
