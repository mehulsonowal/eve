import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";

/** Declining a session token-limit continuation terminally completes the session. */
export default defineEval({
  description: "Stopping at the session token limit cancels and finalizes the session.",
  async test(t) {
    const first = await t.send('Reply with exactly the text "stop ping" and nothing else.');
    first.expectOk();

    await t.send('Reply with exactly the text "stop pong" and nothing else.');
    const request = t.requireInputRequest({
      display: "confirmation",
      optionIds: ["continue", "stop"],
      toolName: "session_limit_continuation",
    });

    const stopped = await t.respond({
      optionId: "stop",
      requestId: request.requestId,
    });
    stopped.expectOk();
    t.notEvent("turn.failed");
    t.notEvent("session.failed");
    t.event("turn.cancelled");
    t.event("session.completed");
    stopped.notEvent("session.waiting");
    t.check(stopped.status, equals("completed"));
    t.check(stopped.sessionId, equals(first.sessionId));
    t.check(t.state.sessionId, equals(undefined));

    const nextSession = await t.send(
      'Post-rejection probe: reply with exactly "new session" and nothing else.',
    );
    nextSession.expectOk();
    nextSession.notEvent("input.requested");
    nextSession.messageIncludes("new session");
    t.check(
      nextSession.sessionId,
      satisfies(
        (sessionId: string) => sessionId !== first.sessionId,
        "the next prompt starts a new session",
      ),
    );
    t.check(nextSession.status, equals("waiting"));
    t.check(t.state.sessionId, equals(nextSession.sessionId));
  },
});
