import type { SessionCancelCause } from "#harness/turn-cancellation.js";

/** Derives the stable session-scoped cancellation hook token. */
export function sessionCancelHookToken(sessionId: string): string {
  return `${sessionId}:cancel`;
}

/**
 * Payload accepted by the session cancel hook. A mismatched `turnId` is a
 * benign no-op; omitting it targets whichever turn owns the hook.
 *
 * `"turn"` cancels the in-flight turn and parks the session on
 * `session.waiting`; `"session"` gracefully ends the whole session, settling
 * `turn.cancelled` → `session.completed`. The graceful path needs a live
 * turn to observe the signal — cancelling a parked session falls back to a
 * hard engine cancel (see `requestWorkflowSessionCancellation`).
 */
export type TurnCancelPayload = {
  readonly turnId?: string;
} & (
  | {
      readonly kind: "session";
      readonly cause: SessionCancelCause;
    }
  | {
      readonly kind: "turn";
    }
);
