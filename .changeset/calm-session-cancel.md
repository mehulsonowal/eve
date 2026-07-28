---
"eve": patch
---

Declining a session token-limit prompt now travels as a generic graceful session cancellation (`{ kind: "session", cause: "limit-declined" }`) instead of a decline-specific signal. When the cancellation reaches a session with no live turn to settle through, the run is hard-cancelled at the engine level so the session ends either way.
