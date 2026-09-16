# Changelog

All notable changes to the Fieldbase AI SP Kit. When the version here is newer than the
copy you uploaded to an assistant, re-upload that assistant's bundle (`bundles/<ai>/`).

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
