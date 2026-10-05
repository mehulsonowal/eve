import { createHash } from "node:crypto";

import type { EveEvalTraceContext } from "#evals/types.js";

const DATADOG_LLMOBS_TRACE_ID_NAMESPACE = Buffer.from("f47ac10b58cc4372a5670e02b2c3d479", "hex");
const W3C_TRACE_ID_PATTERN = /^[0-9a-f]{32}$/iu;
const W3C_SPAN_ID_PATTERN = /^[0-9a-f]{16}$/iu;

export type DatadogRuntimeTraceTrack = "experiments" | "llmobs";

export interface ExperimentRuntimeTraceLink {
  readonly relation: "experiment_runtime";
  readonly traceId: string;
  readonly spanId: string;
  readonly sessionId: string;
  readonly primary: boolean;
  readonly track: DatadogRuntimeTraceTrack;
}

export function resolveRuntimeTraceTrack(
  configuredTrack: string | undefined,
): DatadogRuntimeTraceTrack {
  // `auto` only routes direct dd-trace writer events. eve runtime contexts come
  // from OpenTelemetry, so they default to LLMObs; an explicit experiments value
  // is treated as an application-owned routing override.
  return configuredTrack === "experiments" ? "experiments" : "llmobs";
}

export function resolveRuntimeTraceLinks(
  traceContexts: readonly EveEvalTraceContext[],
  track: DatadogRuntimeTraceTrack,
): ExperimentRuntimeTraceLink[] {
  const links = new Map<string, ExperimentRuntimeTraceLink>();

  for (const traceContext of traceContexts) {
    if ((traceContext.traceFlags & 1) === 0) continue;
    const traceId = toDatadogLlmobsTraceId(traceContext.traceId);
    const spanId = toDatadogLlmobsSpanId(traceContext.spanId);
    if (traceId === undefined || spanId === undefined) continue;

    const key = `${traceId}:${spanId}`;
    const existing = links.get(key);
    if (existing?.primary || (existing && !traceContext.primary)) continue;

    links.set(key, {
      relation: "experiment_runtime",
      traceId,
      spanId,
      sessionId: traceContext.sessionId,
      primary: traceContext.primary,
      track,
    });
  }

  return [...links.values()];
}

function toDatadogLlmobsTraceId(traceId: string): string | undefined {
  const canonicalTraceId = traceId.toLowerCase();
  if (
    !W3C_TRACE_ID_PATTERN.test(canonicalTraceId) ||
    canonicalTraceId === "00000000000000000000000000000000"
  ) {
    return undefined;
  }

  const canonicalApmTraceId = canonicalTraceId.slice(-16).padStart(32, "0");
  const hash = createHash("sha1")
    .update(DATADOG_LLMOBS_TRACE_ID_NAMESPACE)
    .update(canonicalApmTraceId)
    .digest()
    .subarray(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  return hash.toString("hex");
}

function toDatadogLlmobsSpanId(spanId: string): string | undefined {
  if (!W3C_SPAN_ID_PATTERN.test(spanId) || spanId === "0000000000000000") {
    return undefined;
  }
  return BigInt(`0x${spanId}`).toString(10);
}
