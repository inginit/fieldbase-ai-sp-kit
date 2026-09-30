# Changelog

All notable changes to the Fieldbase AI SP Kit. When the version here is newer than the
copy you uploaded to an assistant, re-upload that assistant's bundle (`bundles/<ai>/`).

## v0.3.0 — 2026-09-30

Sync to Fieldbase engine v3.37.x line.

- **New: `isolate: True` opt-out entries** (§3.8 + new §3.10). Canonical
  "Prefer not to answer" / "None of the above" / "N/A" pattern. Renders as a
  checkbox toggle outside the question body; clears + disables inputs on
  select; skips validation; counts as answered; exports as `<qid>o<code>`.
  Live contract accepts on `multi`, `rank`, `openList` / `numberList` row
  overrides, `gridSingle` / `gridMulti` rows, `gridNumber` rows and cols, and
  the scalar-only `options:` block on `number` / `open` / `lookup`. **Not on
  `single`** — use a plain `anchor: True` option there. Landed platform-wide
  v3.36.0–v3.37.2.
- **`.answered` recommended for opt-out gates** (§11). `Q.answered` returns
  True whether the respondent gave a real answer OR picked the opt-out —
  usually all skip logic needs. `.selected` **excludes** isolate codes; the
  old `.selected.any([99])` pattern for detecting a "PNTA" opt-out now
  returns False and must be migrated.
- **`quota().fill()` fully deprecated** (§11 / §12 / §15). Previous demotion
  to "advanced — do not use for completes" is now a full removal from the
  engine surface. The method double-counted with the auto-fill path on
  `endSurvey("complete")`. Author scripts must READ from `quota(...)` only
  (`.isOpen`, `.count`, `.target`, `.remaining`) and route the terminate via
  `endSurvey("quotafull")` when a cell is full.
- **Examples synced** — `stress_test_all_features.yml` gains a §ISOLATE
  coverage block exercising `isolate:` on every supported type; both
  `stress_test_*` and `streaming_wars_2026` now use the read-only quota
  pattern (no `.fill()`).
- Pack tracks the Fieldbase DSL contract as of engine v3.37.x.

## v0.2.0 — 2026-09-16

First public release.

- **Per-AI bundles** (`bundles/{chatgpt,claude,gemini}/`) — each self-contained (authoring
  reference + examples + linter + a clear HOW-TO); Claude's is a drop-in Skill.
- **Quota guidance hardened** — `endSurvey("complete")` is the documented default for
  counting; `quota().fill()` is demoted with an explicit double-count warning. New advisory
  linter rule `quota-fill-default`. Examples corrected to the test-only + complete pattern
  (they previously modelled the double-count).
- **Model-tier guidance** — use each assistant's flagship / high-reasoning tier; fast/mini
  tiers pass the linter but drop logic.
- **Tested with** table in the README (Claude Opus 5, ChatGPT GPT-5.6 Sol, Gemini 3.1 Pro —
  all pass the platform validator).
- **Python linter** (`lint/survey_dsl_lint.py`) — byte-for-byte parity with the Node linter,
  for Python / Code-Interpreter use.
- Pack tracks the Fieldbase DSL contract as of engine v3.34.0.

## v0.1.0 — initial build (pre-public)

- Authoring reference (`SURVEY-DSL-AUTHORING.md`) neutralized from the internal AI SP source.
- Standalone Node style/structure linter, calibrated against the platform validator.
- Synthetic, validator-clean example surveys; MIT license.
