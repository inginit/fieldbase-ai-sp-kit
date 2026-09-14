# Survey DSL authoring — generic agent shim (AGENTS.md)

This project authors **Survey DSL** (`.yml` surveys). Any AI agent working here must
read the complete, model-agnostic reference first:
**[`../SURVEY-DSL-AUTHORING.md`](../SURVEY-DSL-AUTHORING.md)**.

## Operating rules

- Produce `.yml` output only in this project's designated output location; do not touch
  files outside it. When a task seems to need writing elsewhere, stop and ask.
- The reference and `examples/` are read-only inputs.
- Author in one best-effort pass. Log assumptions in a `delta-log` `- note:` block at
  the end of the file rather than interrupting with questions.
- Before declaring a task done, run the bundled linter and clear every error:
  `node ../lint/survey-dsl-lint.js "<survey>.yml"`.
- The linter is a style/structure pass, not a compiler. Deep semantic checks run in the
  platform validator at import/publish. A clean lint ≠ provably valid.
