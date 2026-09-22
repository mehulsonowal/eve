---
"eve": patch
---

Attach deduplicated experiment runtime trace references to Datadog Experiment rows so the LLM Observability UI can resolve and display each eval's related runtime traces. Convert sampled W3C runtime contexts into the trace and span identifiers produced by Datadog's APM-to-LLMObs indexer. Ensure fast evals and immediate failures emit a positive Experiment span duration.
