const TURN_CANCELLED_ERROR_NAME = "TurnCancelledError";

/** Terminal outcome of a cancelled turn. */
export class TurnCancelledError extends Error {
  constructor(message = "The turn was cancelled.") {
    super(message);
    this.name = TURN_CANCELLED_ERROR_NAME;
  }
}

/** Why a session was gracefully cancelled. */
export type SessionCancelCause = "limit-declined";

const SESSION_CANCEL_MESSAGES: Record<SessionCancelCause, string> = {
  "limit-declined": "The user declined a fresh session token budget.",
};

/**
 * A turn cancellation that terminally ends the whole session instead of
 * parking it. Carries intent only — the execution layer detects it at the
 * step boundary and settles `turn.cancelled` → `session.completed`. Keeps
 * the harness free of cross-session cancellation authority.
 */
export class SessionCancelledError extends TurnCancelledError {
  readonly sessionCancelCause: SessionCancelCause;

  constructor(cause: SessionCancelCause) {
    super(SESSION_CANCEL_MESSAGES[cause]);
    this.sessionCancelCause = cause;
  }
}

/**
 * Extracts the session-cancellation cause carried by the error or one of
 * its causes; `undefined` for ordinary turn cancellations.
 */
export function getSessionCancelCause(error: unknown): SessionCancelCause | undefined {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const cause = (current as { sessionCancelCause?: unknown }).sessionCancelCause;
    if (cause === "limit-declined") {
      return cause;
    }
    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}

/** True when the error, or one of its causes, terminally cancels the session. */
export function isSessionCancellation(error: unknown): boolean {
  return getSessionCancelCause(error) !== undefined;
}

/** True when the error, or one of its causes, is a {@link TurnCancelledError}. */
export function isTurnCancellation(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if ((current as { name?: unknown }).name === TURN_CANCELLED_ERROR_NAME) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/** Throws when the turn signal has aborted. */
export function throwIfTurnAborted(abortSignal: AbortSignal | undefined): void {
  if (abortSignal?.aborted !== true) {
    return;
  }
  if (isTurnCancellation(abortSignal.reason)) {
    throw abortSignal.reason;
  }
  throw new TurnCancelledError();
}
