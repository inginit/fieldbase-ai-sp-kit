---
name: fieldbase-survey-dsl
description: Author valid Fieldbase Survey DSL (.yml surveys). Use whenever the user wants to write, convert (from a brief, Word doc, or spec), or edit a survey for the Fieldbase platform (thefieldbase.com), or asks about Survey DSL question types, flow, loops, quotas, piping, or validation. Produces one complete .yml file and lints it.
---

# Fieldbase Survey DSL authoring

Use this skill to turn a survey brief — pasted text, a spec, or an uploaded document —
into a valid Fieldbase Survey DSL `.yml` file, end to end, in one pass.

## How to use this skill

1. **Read `SURVEY-DSL-AUTHORING.md`** (bundled in this skill) before authoring. It is the
   complete, canonical contract: question types, properties, styles, flow blocks, reusable
   lists, scripting, multilingual/multi-country patterns, and the §0 hard rules. Consult it
   whenever unsure; never invent syntax that isn't in it.
2. The bundled `examples/*.yml` are validator-clean worked surveys — copy their shape.
3. Author **one complete `.yml`** in a single best-effort pass; don't stop to ask. When
   something is ambiguous, make the most reasonable choice per the reference and log EVERY
   assumption in a `- note: |` delta-log block at the END of the file.
4. **Lint before finishing.** If you can run code, run the bundled linter on your output and
   fix every error before returning it:
   ```
   python3 survey_dsl_lint.py <your-file>.yml
   ```
   Expect `0 errors`. Warnings are advisory (e.g. `label-affix` is fine on `number`).

## Hard rules (full detail in §0 of the reference)

- Indent with 4 spaces. No tabs.
- Option / row / scale codes are positive integers. No string codes, no negatives.
- Booleans are `True` / `False` (capitalized).
- Identifiers (qid, loop/page/block ids, list names) are letters+digits only — camelCase,
  with `x` between digits (`Q1x1`). No underscores. Use the questionnaire's qid verbatim
  when it is already valid.
- `if:` controls visibility (there is no show_if / hide_if). Piping is `{{ ... }}`.
- A `- loop:` takes DIRECT children (like if/elif/else), NOT a `questions:` wrapper. Every
  loop `id:` must be unique. Define each helper function once (don't re-declare it per block).
- Options are a multi-line block, one code per line — never inline `{1: Yes, 2: No}`.
- Style names are camelCase (`imageCards`, not `image_cards`). `default.errors` is True/False.
- Route respondent-facing validation copy through a hidden multi + a reusable error-message
  list (the `QErrMsg` pattern, §5.6), so every `fail()` reads a pipeable label from one
  place — not a single generic string.
- Never leave an empty `- script:` block (comments only). If a quota gate or logic belongs
  somewhere, write it; if the platform's Quota Builder enforces it instead, omit the block
  and flag the handoff in the delta-log.
- Quotas: gate with `quota(...).isOpen` (read-only) and let `endSurvey("complete")` do ALL
  counting. Never call `quota().fill()` to count completes — it double-counts with complete.
- Research modules (cbc / maxdiff / cardSort / textAnnotation / imageAnnotation /
  videoAnnotation) are wizard-configured; quota cells, list-asset uploads, and custom
  HTML/CSS/JS modules are human tasks. Emit a stub `- qid:` (type + text) and flag each in
  the delta-log.

## Scope

You write only the `.yml`. The Fieldbase platform runs the authoritative validator and the
live survey at import/publish — your output is a draft for that step. The linter is a
mechanical pre-check, not a substitute for importing to Fieldbase.
