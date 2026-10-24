# Changelog

All notable changes to the Fieldbase AI SP Kit. When the version here is newer than the
copy you uploaded to an assistant, re-upload that assistant's bundle (`bundles/<ai>/`).

## v0.4.3 — 2026-10-24

Doc fix. §15.1 documented only the **single-dimension** quota gate — fine
when the cell code happens to equal the dimension value, silent on everything
else. Field report: when faced with a multi-dim quota (e.g. Age × Gender),
AI programmers were defaulting to one of two broken outputs:

1. Hand-arithmetic to compute the cell code — brittle, breaks the moment the
   Builder reorders cells.
2. **Dropping the gate entirely** on the assumption that `endSurvey("complete")`
   handles enforcement. It does not — `complete` **counts** the fill, it does
   not **screen**. Over-quota respondents sailed through and overfilled every
   cell.

Changes:

- **§15.1 restructured** — clearer signature statement (strictly 2-arg, no
  auto-match), added a prominent "`complete` counts, does not screen"
  warning, and split the gate guidance into two named patterns:
  - **Pattern A — single-dimension** (unchanged, cell code == dim value).
  - **Pattern B — multi-dimension** (full worked Age × Gender example from
    the kit's own streaming_wars_2026 example). Shows the canonical
    derivation + hidden interlocked cell question + read-only gate triple.
    Explains WHY the if/elif chain (not arithmetic) and WHY the hidden
    interlocked question (export + analyst visibility).

- **§15.2 updated** — new step 2 explicitly directs the AI programmer to
  author Pattern B for every capped multi-dim quota.

- **§17 mistake #63** — hand-computing a multi-dim cell code with
  arithmetic. The if/elif mapping is the author–Builder contract;
  arithmetic hides that contract behind an auditable-only-by-math formula.

- **§17 mistake #64** — dropping the quota gate because
  "`endSurvey("complete")` auto-fills." The structural pair is
  `if not quota(...).isOpen: endSurvey("quotafull")` for the screen, and
  the eventual `endSurvey("complete")` for the count — **both** are
  required.

No code changes; linters unchanged; engine contract unchanged (still tracks
v3.38.x). The pattern was already in streaming_wars_2026.yml — this release
just documents it.

## v0.4.2 — 2026-10-23

Doc fix. The §6.3 loop property section said *"Exactly one of
`options:` / `options.from:` / `group:`."* — the opposite of what the
engine enforces. The real validator fires `options-from-domain-required`
whenever `options.from:` appears without a companion `options:` or
`group:` to disclose the full response domain. `options.from:` is a
**mask only** — not a replacement for the domain declaration.

- **§6.3 loop properties** — replaced the incorrect "Exactly one of"
  sentence with the correct rule and valid-combinations list:
  - `options:` alone — fixed iterations.
  - `options:` + `options.from:` — fixed domain + runtime filter.
  - `group:` + `options.from:` — grouped domain + runtime filter.
  - `options.from:` alone — INVALID, fires `options-from-domain-required`.

- **§3.2 choices & scale** — added a parity note making the same pairing
  rule explicit for QUESTIONS (previously the §3.2 "mask" phrasing in
  §526/§532 implied it, but didn't name the companion requirement).

The kit's own canonical examples (stress_test, streaming_wars) already
use the correct paired form; this release only fixes the prose. No code
changes; linters unchanged; engine contract unchanged (still tracks
v3.38.x).

## v0.4.1 — 2026-10-11

Documentation fix on top of v0.4.0 — clarifies the scope of the new
expression form for `order:` / `scale.order:`.

- **§3.6 bright-line table** — "Where to put `order:` with a piped subset":
  on a **question** (`multi` / `single` / `rank` / `openList` / `numberList` /
  grid rows) the piped subset auto-inherits the parent's shown order
  (engine v3.38.0 fix); adding `order: Q.all` is redundant. On a **loop**
  or **block**, the expression form IS the explicit switch — keep it.
  v0.4.0's guidance didn't make this distinction, and the AI SP kit was
  seen emitting `order: Q.all` on multi-questions where it's dead code.
- **§0.1 checklist** — original row qualified "on a loop"; new row added:
  "Adding `order: Q.all` to a question whose `options.from:` already pipes
  from the parent" → leave it off.
- **§17 mistake #62** — new entry: redundant question-level `order: Q.all`
  on a piped subset; the resolver returns the inherited sequence either
  way, so keep questions clean.
- No code changes; linters unchanged; engine contract unchanged (still
  tracks v3.38.x).

## v0.4.0 — 2026-10-10

Sync to Fieldbase engine v3.38.x line.

- **New: expression form on `order:` + `scale.order:`** (§3.6 + §6.2/§6.3).
  `order:` now accepts an expression resolving to an ordered code list in
  addition to the keyword forms (`fixed` / `random` / `randomEach` / `flip` /
  `alphabetical` / `reverse`). Forms: accessor (`Q1.all`, `Q1.selected`),
  method chain (`.union()` / `.minus()`), def function call, a literal list
  (`4,2,3,1`), or a captured hidden (`hOrder.rows`). Membership stays with
  `*.from:`; `order:` is sequence-only. Anchors + `isolate:` opt-outs are
  excluded from the orderable set as today. Deterministic — editor-preview
  and respondent engine produce byte-identical sequences for the same
  answers. Scope: question option / row domains (single, multi, rank,
  openList, numberList, gridSingle, gridMulti, gridNumber, mixGrid rows),
  within-group options, `scale.order:` on grids, `col.order:` (alias of
  `scale.order:` on gridNumber), **loops** (iterate a source's shown
  order), and **blocks** (impose a stored sequence on child blocks by id).
  `group.order` by expression deferred. Keyword vs expression: a value is
  a keyword iff it exactly matches one of the six reserved words; anything
  with expression syntax (`. ( ) [ ] ,`) is parsed as an expression.
- **Random-order consistency fix** — the respondent render used to carry a
  DUPLICATE shuffle, silently breaking carry-forward (`Q.all` / `Q.selected`
  and the respondent's displayed order didn't match). The duplicate is
  removed. One visible change: a **piped subset**
  (`options.from: QParent.selected`) now **inherits the parent's shown
  order** instead of being independently reshuffled. Data unaffected
  (stored by code); a legacy survey that depended on the broken reshuffle
  will see displayed order shift. New §17 mistake #61 documents the
  behavior change and the migration path.
- **New §17 mistake #60** promoting the expression form for order-mirroring
  (previously accomplished by shuffle helpers or secondary `random`-mode
  questions — now a one-liner on `order:` / `scale.order:` / `block.order:`).
- Pack tracks the Fieldbase DSL contract as of engine v3.38.x.

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
