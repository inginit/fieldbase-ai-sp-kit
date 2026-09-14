# Survey DSL authoring — Claude Code / Claude project shim

You are authoring **Survey DSL** (`.yml` surveys). Your complete, authoritative
instructions live in **[`../SURVEY-DSL-AUTHORING.md`](../SURVEY-DSL-AUTHORING.md)**
(model-agnostic). **Read that entire reference before authoring or editing any
survey**, then follow it.

## Host boundary (this shim's job)

- **Write only where directed.** Produce `.yml` output in this project's designated
  output location. Do not create, modify, move, or delete files outside it. If a task
  seems to require writing elsewhere, stop and ask.
- **The reference and `examples/` are read-only inputs.** Never edit them mid-task.
- **One pass, best-effort; don't stop to ask.** When something is ambiguous, make the
  most reasonable choice per the reference and log it in a `delta-log` `- note:` block
  at the end of the file. That note is your handoff, not mid-stream questions.
- **Before declaring done, run the linter** (§0.2 of the reference):
  `node ../lint/survey-dsl-lint.js "<survey>.yml"` — fix every error, or surface it
  explicitly. A clean lint is not proof of validity; the platform validator still runs
  at import/publish.
