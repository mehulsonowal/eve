import {
  createSessionCompletedEvent,
  createSessionWaitingEvent,
  createTurnCancelledEvent,
} from "#protocol/message.js";
import type { HarnessEmitFn } from "#harness/types.js";
import type { HandleMessageStreamEvent } from "#protocol/message.js";

import { activeTurnId } from "#harness/active-turn-id.js";
import type { HarnessEmissionState } from "#harness/emission.js";

/**
 * Emits the cancelled-turn epilogue (never a failure event) and returns the
 * between-turns emission state. Ordinary turn cancellation parks on
 * `session.waiting`; terminal session cancellation ends on
 * `session.completed`.
 *
 * `state` is the last *persisted* emission state, which may predate the
 * cancelled turn's preamble — the turn id is reconstructed via
 * {@link activeTurnId} and `sessionStarted` is stamped `true`.
 */
export async function emitCancelledTurn(
  emitFn: HarnessEmitFn,
  state: HarnessEmissionState,
  continuationToken: string,
): Promise<HarnessEmissionState> {
  return await emitCancelledTurnBoundary(
    emitFn,
    state,
    createSessionWaitingEvent(continuationToken),
  );
}

/** Emits the terminal boundary for a gracefully cancelled session. */
export async function emitCancelledSession(
  emitFn: HarnessEmitFn,
  state: HarnessEmissionState,
): Promise<HarnessEmissionState> {
  return await emitCancelledTurnBoundary(emitFn, state, createSessionCompletedEvent());
}

async function emitCancelledTurnBoundary(
  emitFn: HarnessEmitFn,
  state: HarnessEmissionState,
  boundary: HandleMessageStreamEvent,
): Promise<HarnessEmissionState> {
  await emitFn(
    createTurnCancelledEvent({
      sequence: state.sequence,
      turnId: activeTurnId(state),
    }),
  );
  await emitFn(boundary);

  return {
    sessionStarted: true,
    sequence: state.sequence + 1,
    stepIndex: 0,
    turnId: "",
  };
}
