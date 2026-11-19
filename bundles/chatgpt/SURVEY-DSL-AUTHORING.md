# Survey DSL — AI Authoring Reference

**Read this entire reference before authoring or editing any survey.**

This is the complete knowledge an AI programmer needs to convert a survey brief — a
Word document, a spec, or a natural-language request — into valid **Survey DSL**
(YAML structure + a Python-subset logic), end-to-end, in one pass. It is
model-agnostic: any capable AI (or human) can follow it. Pair it with the bundled
standalone linter (`lint/survey-dsl-lint.js`, see §0.2) to catch the common
mechanical mistakes before handoff.

## Target platform

The DSL targets the **Fieldbase survey platform** (<https://thefieldbase.com>). The
`.yml` you author is imported and published there; the platform compiles it, runs the
respondent survey, and hosts the fielding, quotas, translations, and data export. The
platform's own validator and runtime are the authority on what executes — the linter
in this kit is a fast offline pre-check, not a substitute for import/publish on
Fieldbase (see §0.2).

> **Kit v0.5.0** · tracks the Fieldbase DSL contract as of engine **v3.45.0** (strict script language — §10; named end pages — §6.7). When
> Fieldbase adds or tightens rules, the pack and the linter are updated together (see the
> note at the end of §0.2). If your uploaded copy shows an older version than the repo,
> re-upload the bundle.

---

## Output & knowledge sources

**Where output goes.** The AI programmer produces `.yml` survey files. Write them
only where your host integration directs — a project workspace, an output folder, or
the editor buffer you were invoked on. Do not write anywhere your host has not
designated; when a task seems to require writing outside that workspace, stop and
ask. This reference and the bundled worked examples are **read-only inputs**.

**What grounds this work.**

| Source | Use for |
|---|---|
| **This authoring reference** | Canonical DSL syntax, question types, properties, styles, runtime semantics, and the §0 hard rules. The source of truth for what is valid. |
| **The bundled worked examples** (`examples/`) | Real surveys that show how each pattern is written — list patterns, validation idioms, loop shapes, piping, every question type. **When in doubt about authoring shape, copy from here.** |

## 0. Hard rules — never violate

1. **Indentation is 4 spaces. No tabs. No 2-space.** Every property, every nested entry, every block child is at exactly 4 more spaces than its parent.
2. **All option / row / scale codes are numeric.** No string codes. **No negative codes.** Codes are positive integers (or zero).
3. **Booleans are `True` / `False` only.** Capital first letter. Applies to `required`, `readonly`, `anchor`, `exclusive`, `specify`, `total`, `decimal`, `inactive`, `default.errors`, `show.label`, `multi`.
4. **Use canonical names only — never deprecated aliases.** See §13.
5. **`qid` is the runtime handle.** Must be unique. Becomes the script accessor (`QBrand`, `QAge`, etc.).
6. **`if:` controls visibility.** `show_if` / `hide_if` are not supported.
7. **Piping uses `{{ ... }}` (double curly braces).** Single braces are not piping.
8. **Code the whole document in one pass, best-effort. Do not stop to ask.** When something is ambiguous, make the most reasonable choice using the conventions in this file and the KB, then **log every assumption in a `delta-log` note at the end of the file**. The human programmer reviews the delta-log; that is your handoff, not mid-stream questions.
9. **Never reword, rephrase, re-punctuate, expand, or otherwise "improve" an existing question's text or its option labels unless the instruction explicitly asks you to change that specific wording.** Changing the wording of a question that is already in field invalidates the data collected against it and forces a re-field. This rule governs every edit path — a request to add a new question, change a flow, fix a typo in one place, or restructure logic is **not** permission to clean up wording anywhere else. "Existing text" means every `title:` / `text:` / `label:` / `prompt:` / scale and row label / `validation:` error string / piped text literal already present in the file. When converting a fresh spec into DSL, option and row text is copied **verbatim** from the source — same casing, same punctuation, same contractions, same trailing full stop or lack of one. If the spec contains a typo and you decide to preserve it, add a `# verbatim: original spec` comment on that line; if you decide to fix it, name the fix in the `delta-log`. Never silently normalize ("Strongly agree" → "Strongly Agree", "Don't know" → "Do not know", stripping or adding periods, title-casing a sentence-case label, pluralizing "year" to "years"). The AI never has implicit authority over copy — that authority belongs to the client's questionnaire.

### 0.1 Style — bright-line checklist (scan every edit)

These are the most common style violations across surveys. If an edit touches any of these surfaces, verify against this list **before** moving on. Each one has fired in real surveys multiple times — they are not theoretical.

| ✗ Never do | ✓ Do instead |
|---|---|
| Rewording / re-punctuating an existing question's text, option labels, row labels, or validation error strings during an edit the user did not ask about | Leave existing wording **verbatim**. The hard rule (§0 #9) applies — a change request to one surface is never implicit permission to clean up wording elsewhere. If a wording change is actually required, name the exact surface in the `delta-log` with the before/after. See also §17 mistake #65 |
| `options: {1: Yes, 2: No}` (inline `{k:v}` form) | Multi-line options block, one code per line |
| Underscores in qids / loop ids / list names (`Q_Age`, `brand_loop`) | camelCase / `x`-between-digits: `QAge`, `brandLoop`, `Q1x1` (§1) |
| `Q.any([codes])` (no `.selected`) | `Q.selected.any([codes])` — works on **both** single and multi (#54) |
| Arithmetic or `<` / `>` on an answer that may be unanswered (`Q.value + 1`, `Q.value < 3` with no guard) | Coalesce `(Q.value or 0)` or gate on `Q.answered` — `None` in arithmetic is a runtime error (§10.0, #58) |
| `Q.selected.add([code])` (multi mutation via `.selected`) | Build a fresh tri-state payload + `Q.set({...})` (§12 multi) |
| Negative option codes (`-5: …`) | Renumber to positive ints; put the original delta in the label (`1: Decreased significantly (-5)`) |
| `label.prefix:` / `label.suffix:` on `single` | Bake anchors into the first/last option labels |
| `style: dropdown` on `gridSingle` | Not canonical — drop the property; the platform picks rendering |
| `style: buttons` with NPS scales: also drop `label.prefix`/`suffix` | Anchors in labels |
| A value used as a condition: `if Q.value:`, `if Q.selected:`, `if not request.param("x"):`, `if: 1` | A yes/no test: `if Q.answered:`, `if Q.selected.size > 0:`, `if request.param("x") == "":` (§10.0, #56) |
| `Q.answered == 1` / `Q.answered == 0` | `Q.answered` / `not Q.answered` — it is True / False, never a number (§10.0) |
| Quoted codes or text in a coded hidden: `Q1.value == "2"`, `hSegment.set("premium")` | Codes are numbers: `Q1.value == 2`, `hSegment.set(1)` with the meaning in the option label (§10.0) |
| A code the question does not declare: `Q1.set(9)`, `Q.row(12)`, `Q.selected.any([1, 9])` | Only codes / rows / scale points that exist on that question — anything else blocks publish (§10.0) |
| `if Q.value is None` on an `open` question, or on `.selected` / `.values` | Text is `""` and lists are empty, never `None`: `not Q.answered`, `Q.value == ""`, `Q.selected.size == 0` (§10.0) |
| Block comment `#[[ … #]]` | Removed. `#` on each line, or `- note: \|` between blocks (§10) |
| f-strings, `"%.2f" % x`, `.format()`, `//` | `"..." + str(x)`, `round(x, 2)`, `int(a / b)` (§10.2) |
| An `if` test continued onto a second line (`\` or wrapped brackets) | One line, or move the test into a `def` helper (§10.0) |
| `questions:` wrapper on a `- loop:` block | Loops take DIRECT children (like `if`/`elif`/`else`), NOT a `questions:` wrapper. Validator fires `loop-questions-not-allowed`. `- script:` IS allowed inside loop bodies for per-iteration side effects. `questions:` is still valid on `- page:` and `- block:`, just not on `- loop:` (§6.3) |
| Duplicate `- loop:` id | Two loops sharing an explicit `id:` collide — iterations key by id and exports derive columns from it, so their data merges. Validator fires `duplicate-loop-id`. Every explicit loop id must be unique across the survey |
| `- if: <expr>` as a sibling list item with no children indented under it | `- if <expr>:` flow-block form with children at +4 indent (§6.4 / #61). For "should this iteration run at all," use `options.from:` on the loop instead |
| `options:` / `options.from:` / `group:` on a `mixGrid` child column | The row domain comes from the parent. If you need a per-row answer domain, the cleanest pattern is `gridSingle` with `scale: <list>`; reserve `mixGrid` for cases the validator's column type list actually fits |
| `.selectedLabel` on a `numberList` / `openList` row | Not a row-level accessor. Use a lookup helper, or pipe a different field |
| `- title:` / `- description:` as top-level metadata blocks | The DSL has no such top-level blocks. Drop them; use a `# comment` header |
| Inventing `h` / `H` / `HQ` prefix when the qnr already names the hidden | Use the qnr's name verbatim. Reserve `h` for hidden helpers AI introduces beyond the qnr (#57) |
| Comments inside a `lists:` block at the same indent as child keys | Lift to one level above the list name, or indent deeper than data keys (#59) |
| Multi-paragraph `text:` field with bare newlines between paragraphs | Insert `<br><br>` — the platform doesn't render plain newlines |
| Bold/italic/underline from the source docx dropped during conversion | Capture `<b>` / `<i>` / `<u>` runs from the docx and emit inline (§19) |
| `options.from: \|` followed by multi-line code | `options.from:` is a one-liner: either a direct accessor (`QBrand.selected`) or a helper call (`myFilterRows()`). If logic needs more than one expression, name it: define a helper in a `- script:` block and reference it by name. Keeps the question block scannable |
| `style: image_cards` (snake_case) on `single` / `multi` | Style names are camelCase: `style: imageCards`. The snake_case form is rejected by the validator; the camelCase form is accepted by both validator and renderer (§4) |
| `exclusive: True` on a `single` option | Multi-only. `single` already enforces one-selection; an exclusive PNTA is just `anchor: True` (§3.8) |
| `label.prefix:` / `label.suffix:` on an `openList` option entry | Not valid on openList entries. Bake the prefix into the row's `label:` directly, or set affixes at question level (§3.8) |
| `left.label:` / `right.label:` on a `gridSingle` paired `scale:` entry | Belongs on row option entries, not scale entries. Each ROW carries its own left/right anchor pair (§3.8) |
| `rows: { options: listName }` (nested) on `gridNumber` | gridNumber rows/cols take inline numeric codes — `rows: { 1: Jan, 2: Feb }`. No nested `options:` shape (§2) |
| Opt-out coded via `exclusive: True` alone (old pattern) when you want split-render + skip-validation + companion export column | Use `isolate: True` (typically with `exclusive: True`) — see §3.10. `isolate` lifts the option out of the choice pool into an external checkbox toggle, clears+disables inputs on select, skips validation, exports as `<qid>o<code>`. Old pattern still works but doesn't get any of that treatment. |
| Branching on an opt-out via `Q.selected.any([99])` after upgrading to `isolate: True` | `.selected` **excludes** isolate codes. For simple "did they answer?" gates, `Q.answered` returns True whether the respondent gave a real answer or picked the opt-out — that's usually all you need. Migrate any legacy `.selected.any([<optOutCode>])` branches when you convert an opt-out to `isolate: True`. Only reach for a dedicated opt-out accessor when a downstream flow needs to distinguish "answered normally" from "opted out" — and check the current runtime API for the name |
| Re-authoring order mirroring with a shuffle helper or a second `random`-mode question so a **loop** iterates in the parent's shown order | `order:` + `scale.order:` accept an **expression** (engine v3.38.0+). On a **loop**: `options.from: QBrand.selected` + `order: QBrand.all` iterates picked brands in the order the respondent saw them. Same shape for `block.order:` imposing a stored `[2,4,1,3]` sequence. **Scope limit** — on a question-level `options.from:` subset (`multi` / `single` / `rank` / `openList` / `numberList` / grid rows) the piped subset already **auto-inherits** the parent's shown order (v3.38.0 behavior-change); adding `order: Q.all` there is redundant — leave it off. (§3.6) |
| Adding `order: Q.all` to a question whose `options.from:` already pipes from the parent | Redundant with v3.38.0 auto-inheritance — the engine produces an identical sequence either way. Keep `order:` expression form on **loops** (iteration order) and **blocks** (child-block sequence); drop it on question-level piped subsets so the question block stays scannable. (§3.6) |
| `quota(group, code).fill()` in a script (used to be the manual single-cell increment) | Removed. The engine auto-fills cells on `endSurvey("complete", CompletePage)`. Author scripts should only READ from `quota(...)` (`.isOpen`, `.count`, `.target`, `.remaining`) and terminate with `endSurvey("quotafull", QuotaFullPage)` when the target cell is full. See §15 |
| `endSurvey("terminate")` on its own — no page, no redirect (refused at publish from engine v3.45.0), or relying on "the question written after the script" as the closing page | Name the end page: `endSurvey("terminate", TermPage)`, and / or put `redirectUrl("https://…")` on the next line. The page is a `type: info` question, usually at the bottom of the file. See §6.7. |

If an edit touches any of these surfaces, run the lint workflow in §0.2 **before** declaring the task done.

### 0.2 Lint workflow — required before declaring a survey edit "done"

Every survey edit pass ends with a linter run. **Do not report a task complete
without it.** The linter is a standalone, zero-dependency script bundled with this
kit — it needs only Node, no engine and no network:

```bash
node lint/survey-dsl-lint.js "<survey>.yml"
# Expected: "0 errors". Any error must be fixed in the same turn, or surfaced explicitly.
```

The linter enforces the §0 hard rules and the §0.1 bright-line style list — the
surfaces that cause the most real-world breakage: tabs / non-4-space indentation,
non-numeric or negative option codes, `true`/`false` instead of `True`/`False`,
inline `{k: v}` options, underscored qids / ids / list names, `Q.any(` without
`.selected`, `label.prefix`/`suffix` misuse, `style: dropdown` on `gridSingle`,
snake_case `style:` names, `questions:` on a `- loop:`, multi-line `options.from:`,
duplicate qids / loop ids, an `endSurvey(...)` with neither an end page nor a
`redirectUrl(...)` on the next line (§6.7), and the script-language removals of engine v3.44.0:
`#[[ … #]]` block comments, `//`, f-strings, `%` / `.format()` text formatting,
`.answered == 0/1`, and backslash line continuation.

> **Scope — style and structure, not deep semantics.** This is a *lint pass*,
> deliberately not a full compile/validate. It catches the frequent, mechanical
> mistakes fast and offline. It does **not** replace the platform's own syntax/logic
> validation, which runs server-side when the survey is imported or published. Where
> a rule would need the full grammar to decide, the linter stays conservative (it
> warns rather than guesses). Treat a clean lint as "no obvious violations," not
> "provably valid."

### 0.3 Renderer-preview verification — required when `style:` differs from default

**The syntax validator does NOT exhaustively enforce per-type style enums.** A misspelled `style:` value (e.g. `cardStak` instead of `cardStack`, or `slideTicks` instead of `sliderTicks`) passes the validator silently — the renderer falls back to the default skin and nobody notices until a respondent sees the wrong UI.

When an edit sets `style:` to anything outside the default, the lint workflow alone is **not** sufficient. Add a manual step:

```bash
# 3. Skin verification — render each non-default style in preview.
# Pull every style: value declared in the file and check each against
# the §4 matrix.
F="<survey>.yml"
grep -nE "^\\s+style: " "$F" | sort -u -k 2
# For each (qid, style) pair returned: preview-render in the platform's
# skin matrix and confirm the live UI matches
# the intended skin.
```

When in doubt about the exact skin name, **don't rely on the syntax validator's silence as approval.** Cross-check against:

1. The §4 skin matrix above (camelCase, name-by-name).
2. The renderer's live preview — the only true source for "this skin name resolves to this UI."

Add the skin in the §SKIN block of `stress_test_all_features.yml` if it's not already there, so future preview passes catch typos via cross-reference.

---

Whenever a new violation class shows up in a real survey, add a row to §0.1 and a rule to the linter. When a new style name surfaces (from the renderer's skin matrix), add a row to §4 and a question stub to `stress_test_all_features.yml` §SKIN. The lint workflow is alive; it grows as the project learns.

---

## Multilingual authoring — content in any language, syntax in English

The AI programmer supports prompts and content in any language (French, Spanish, German, Portuguese, Italian, Dutch, Japanese, Mandarin, Arabic, Hindi — whatever the programmer works in). The split:

**English-only (DSL is language-independent syntax):**
- All keywords: `qid`, `type`, `single`/`multi`/`rank`/`open`/`number`/`openList`/`numberList`/`gridSingle`/`gridMulti`/`mixGrid`/`lookup`/`info`, `options`, `scale`, `group`, `text`, `title`, `instruction`, `required`, `min`, `max`, `exact`, `if`, `script`, `loop`, `block`, `page`, `note`, `lists`, …
- Boolean literals: `True` / `False`
- Runtime helpers and built-ins: `fail()`, `print()`, `endSurvey()`, `quota()`, `len`, `sum`, `avg`, `random.choice`, `re.fullmatch`, `math.floor`, `datetime.today`, …
- Python keywords: `if`, `elif`, `else`, `for`, `while`, `def`, `return`, `and`, `or`, `not`, `in`, `is`, …

**Target language (whatever the programmer prompts in):**
- `text:`, `title:`, `instruction:` on every question and structural block
- Option / scale / row / group `label:` values
- Specify entry labels, prefix / suffix text, paired-grid `left.label` / `right.label`
- Strings passed to `fail()` and `print()` — or, preferred, the labels in the `errMessages` list (§5.6) which becomes the single translation seam
- `#` comments inside scripts and `- note: |` blocks

**Keep ASCII (for SPSS / export portability):**
- `qid` identifiers — they become wide-export column names; most analysis tools reject accents and non-Latin characters in variable names. A French survey still uses `QSatisfaction`, not `Q_satisfaction_à_propos_de`.
- List names (`appealOptions`, `phoneBrands`, `errMessages`)
- Python variable names inside scripts (`i`, `total`, `candidates`, `is_premium`)
- Loop ids (`brandLoop`, `conceptLoop`) — camelCase, no underscores
- Page / block ids (`demographicsPage`, `brandSection`) — camelCase, no underscores

**Translation pattern.** The `errMessages` list + `QErrMsg` hidden multi (§5.6) is the canonical translation seam — every `fail(...)` reads from it, so all respondent-facing error copy lives in one place. When a survey ships in multiple languages, the platform's runtime translation context renders the active language at respondent time; the AI's per-language job is to fill the `errMessages` list (and every other content field) in the target language.

**Tiny shape comparison.**

```yaml
# French
- qid: QSatisfaction
    type: single
    text: Dans l'ensemble, quel est votre niveau de satisfaction?
    required: True
    options:
        1: Très insatisfait
        2: Très satisfait

# Spanish
- qid: QSatisfaccion
    type: single
    text: En general, ¿cuál es su nivel de satisfacción?
    required: True
    options:
        1: Muy insatisfecho
        2: Muy satisfecho
```

Same DSL skeleton, different content. Mirror this for any target language.

---

## Multi-country authoring — country-gated content with `hCountry`

For multi-country / multi-market studies (e.g., one survey shipped to US, Australia, Brazil, China, Indonesia, Korea simultaneously), follow this pattern. It's distinct from "multilingual authoring" above — multilingual is about TRANSLATING content; multi-country is about country-gated LOGIC plus translation, with a single hidden helper driving every market-specific branch.

### The master is English

All logic, qids, list names, validation messages, `text:` / `title:` / `instruction:` / option `label:` content, and reference structure are authored in **English**. The English DSL is the canonical artifact; non-English versions are produced by the platform's translator module from an XML import — **not by the AI**. The AI programmer does not embed Spanish / Portuguese / Mandarin / Korean translations in the DSL.

When the survey ships in 6 languages, AI writes:

```yaml
text: What is your age?       # ✅ master English
```

NOT:

```yaml
text: Quel est votre âge ?    # ❌ translator handles this, not AI
```

### The `hCountry` pattern

One hidden `single` drives every country-conditional branch. Place it at the very top of the file with the other state-holder hidden helpers.

```yaml
- qid: hCountry
    type: single
    visibility: hide
    title: Respondent country (set from URL lang param)
    options:
        1: US
        2: Australia
        3: Brazil
        4: China
        5: Indonesia
        6: Korea
```

### Punch `hCountry` from `request.param("lang")` — at the very top of the survey

The script that sets `hCountry` must run before any country-gated question renders. Place it as the **first script in the file**, immediately after the `hCountry` definition (per the traversal-execution rule §6.5, scripts run at their document position — and `hCountry` must be set before any consumer reads it).

```yaml
- script: |
    # Map URL lang param to country code. Runs first; sets hCountry before any
    # country-gated question reads it.
    lang = request.param("lang")
    if lang == "en-US":
        hCountry.set(1)
    elif lang == "en-AU":
        hCountry.set(2)
    elif lang == "pt-BR":
        hCountry.set(3)
    elif lang == "zh-CN":
        hCountry.set(4)
    elif lang == "id-ID":
        hCountry.set(5)
    elif lang == "ko-KR":
        hCountry.set(6)
    else:
        hCountry.set(1)   # Fallback to US when lang is missing or unrecognized
```

`request.param("lang")` returns `""` for a missing key (§10.7), so the `else` branch catches both unrecognized values and empty strings.

### All country logic gates on `hCountry.value` — never on `request.param("lang")`

Single source of truth. Once `hCountry` is set, every market-specific branch reads from it:

```yaml
# US-only Hispanic origin question
- qid: SHispanic
    type: single
    if: hCountry.value == 1
    text: Are you of Hispanic or Latin origin?
    options:
        1: Yes, I am of Hispanic or Latino origin
        2: No

# Multi-country gate
- qid: SNonBinaryFlag
    type: single
    if: hCountry.value == 1 or hCountry.value == 3   # US & Brazil only
    ...

# China-only city tier
- qid: SChinaCity
    type: single
    if: hCountry.value == 4
    text: Which type of city do you live in?
    ...
```

Never write `if: request.param("lang") == "en-US"` directly — `hCountry` is the contract that downstream questions / quotas / scripts read.

### Country-specific option variants — ONE qid is the default

**Default rule: code ONE qid per question even when option labels vary per market** — different currencies (S7 USD vs S7 IDR), different category sets (S6 ethnicity tables), different regional brands. The translator module fills in per-market labels per language at runtime. Codes are the analyst's interface; the master English option set is the canonical documentation.

```yaml
# ✅ Default — one qid, one option set as the master English. Translator
#    fills en-AU, id-ID, etc. with their own currency labels.
- qid: S7
    if: hCountry.value == 1 or hCountry.value == 2 or hCountry.value == 5
    type: single
    text: Which of the following ranges includes your total annual household income before taxes?
    required: True
    options:
        1: Less than $25,000
        2: $25,000 - $49,999
        3: $50,000 - $74,999
        # ... US-USD ranges as the master ...
        8: $250,000+
        99: Prefer not to answer
```

**Why one qid:** the master file is the analyst's reference. Reports run in English on the master labels. Codes are positional and consistent across markets — code 5 means "the 5th income bracket" no matter who answered. The translator gives respondents their localized view at runtime; the analyst never sees that view, only the codes.

**When to use SEPARATE qids per country** — three cases, and only these three:

1. **The qnr literally names them separately** — e.g., the source document declares `S7BR` and `S8BR` as distinct qids. Then they ARE different questions; honour the qnr.
2. **The code scales differ structurally** — e.g., S7 has 8 codes (US/AU/ID annual income) and S8 has 10 codes (CN/KR monthly income). Different code spaces → different qids. (This is what S7 vs S8 captures in the SHOPPER doc — both are "income" but in different units with different bracket counts.)
3. **The analytical comparison demands it** — when stakeholders explicitly say cross-market codes aren't comparable and want per-country columns. Rare; ask before defaulting to it.

For everything else — same question, same code count, different labels per market — **one qid, translator handles labels per language**.

The mockup at `surveyDsl/mockup/translations.html` shows the per-question translation container: one master question, one set of codes, an empty slot per language for the translator to fill. Trust this layer rather than fanning out qids in the DSL.

### Quotas per market

Quotas are still human-task in the Quota Builder. AI's job: punch `hCountry` reliably so the quota engine can read it for cell qualification. In the delta-log, list the expected country quota (e.g. `qtCountry` with 6 cells at n=1000 each per the SHOPPER doc).

### What AI does NOT do for multi-country

- **Translations** — translator module handles non-English. AI writes English text only.
- **Currency conversion** — typically project metadata, not DSL content. Flag in delta-log.
- **Date / number format localization** — platform-handled. Flag if the source doc specifies.
- **Market-specific list-asset uploads** — human task (per §A).
- **Country-specific quota cell rows** — Quota Builder, per §15.

### Hidden helper naming in multi-country surveys

When the qnr defines its own hidden-helper variables (the SHOPPER doc lists `HQDAGE`, `HQGEN`, `HQINCOME`, `HQREGION`, `HQCHN`, `HQBZN`, etc.), **use the qnr's names verbatim** — those are the analyst's handles in every report. AI's own helpers (added beyond what the qnr specifies) follow the standard `h` prefix: `hCountry`, `hSegment`, `hHabit`.

---

## A. Scope — the AI programmer vs the human programmer

**The AI programmer does (everything that goes in the `.yml` file):**
- Reads the Word doc end-to-end.
- Authors `qid` blocks, `page`, `block`, `loop`, `if`/`elif`/`else`, `script`, `note`, and the `- lists:` block at the bottom.
- Codes question text, instructions, options, scale, groups (with anchors / exclusives / specifies / DK / None-of-these boilerplate).
- Authors `if:` show-conditions, `validation: |` Python blocks, `script:` flow logic, screen-out termination, piping, masking via `options.from`/`scale.from`.
- Authors `type: lookup` questions that **reference** an existing named list asset.
- Authors `type: cbc` / `type: maxdiff` conjoint questions **in full**, referencing an uploaded design by name (§2.1).
- Ends the survey with a named end page (§6.7): `endSurvey("terminate", TermPage)` for screen-outs, `endSurvey("quotafull", QuotaFullPage)` at a full quota, `endSurvey("complete", CompletePage)` at the end of qualifying paths — and authors those end pages.
- Writes a `- note: |` `delta-log` block at the bottom flagging every assumption and every wizard handoff.

**Human programmer does (NOT the AI programmer — leave stubs and flag in delta-log):**
- **Quota cell definitions** — created via the Quota Builder UI. AI marks which questions feed quotas, inserts `endSurvey("complete", CompletePage)`, and (when applicable) **authors the least-fill assignment script that reads from the quota** (§16.10). AI names the required quota group in a comment directly above the script so the human knows what to build. AI does **not** generate the cell tables themselves.
- **Research module wizards** — `cardSort`, `textAnnotation`, `imageAnnotation`, `videoAnnotation`. Wizard-configured. AI inserts a stub `- qid:` with `type:` and `text:` only.
- **Conjoint design uploads** — uploading the CBC / MaxDiff design file in Assets → Designs. There is **no CBC or MaxDiff wizard**: AI authors the `cbc` / `maxdiff` question in full (§2.1) and flags the design name the file must be uploaded under.
- **Lookup list data uploads** — uploading the `.json` / `.csv` to the lookup server. AI authors against the named list and flags the expected list name + columns.
- **List Assets uploads** — same idea for any list-asset workspace.
- **Custom HTML/CSS/JS modules** — `custom: |` content edited via the Custom editor.
- **Survey-level metadata** — project ID, language config, theme, skin selection, branding.
- **Export configuration** — wide vs long, tri-state projection, module long files.
- **Anything wizard-driven.** If a feature requires clicking through a setup wizard, leave a stub and flag.

---

## 1. File anatomy

A `.yml` file is a sequence of **top-level blocks**, each starting with `- ` at column 0:

| Block | Purpose |
|---|---|
| `- qid: <name>` | A question. |
| `- page:` | A respondent step containing question(s). |
| `- block:` | A structural grouping/rotation container. |
| `- loop:` | Iterate question(s) over a domain. |
| `- if <expr>:` / `- elif <expr>:` / `- else:` | Conditional flow. |
| `- script: \|` | Free-standing Python-subset code. |
| `- note: \|` | Author comment. Ignored by all evaluators. |
| `- lists:` | Reusable named option/scale/group domains. **Place at the bottom of the file.** |

The **end pages** — the `type: info` questions a script names when it ends the survey (`TermPage`, `QuotaFullPage`, `CompletePage`; §6.7) — go together just above `- lists:`. They are ordinary `- qid:` blocks, but the survey never walks through them: each is shown only to a respondent whose survey ended on it.

There is **no `- survey:` wrapper** — the file *is* the survey.

### Indentation ownership

```yaml
- qid: QFavBrand        # 0 spaces — top-level marker
    type: single        # 4 spaces — question property
    options:            # 4 spaces — collection property
        1: Target       # 8 spaces — option entry
        2: Walmart      # 8 spaces
        97:             # 8 spaces — entry with sub-properties
            label: Other          # 12 spaces — entry property
            specify: True         # 12 spaces
```

### qid naming — **use the questionnaire's qid verbatim**

**Rule:** the qid is the analyst's and the stakeholder's handle on the data — it appears in the SPSS export, the data tables, the report, and every conversation about the survey. The questionnaire's qid is canonical. Use it exactly as written.

| Source qid | DSL qid |
|---|---|
| `Gender` | `Gender` ✅ |
| `QBrand` | `QBrand` ✅ |
| `Age` | `Age` ✅ — never `SAge`, never `Q_age`, never any prefix |
| `LivingSituation` | `LivingSituation` ✅ |
| `Q1`, `Q2`, ... (the qnr labels questions only by number) | `Q1`, `Q2` — already SPSS-safe, leave as-is |
| `1`, `2`, ... (pure numeric labels) | prepend `Q` (or `S` for screeners) → `Q1`, `S2`. **This is the only situation that justifies a prefix.** Pure numeric variable names break SPSS. |

When the qnr already uses an alphanumeric label, **do not invent prefixes**. Do not turn `Gender` into `SGender`, `QGender`, or `gender_q`. Stakeholders refer to "Gender" — the variable must also be `Gender`.

| Exception | Convention |
|---|---|
| Hidden helpers / derived flags **not in the qnr** | `h` prefix is a soft convention (`hSegment`, `hAvgRating`, `hHabit`). Programmers may also name without the prefix (`country`, `segment`) — **all hidden helpers ship to the analyst's export regardless**, so the prefix is for authoring readability, not data routing. Pick one convention per project and stick to it. |
| Info-only intros / outros **not labeled in the qnr** | descriptive identifier (e.g. `ScreenIntro`); flag in delta-log so the human can rename to match the project's convention |
| Loop / page / block ids | camelCase → `brandLoop`, `demographicsPage` |

### Normalizing identifiers and codes from the source document

Questionnaires routinely arrive with formatting artifacts and label schemes that aren't valid DSL syntax. **Strip the artifacts, preserve the intent** — these are normalization, not renaming.

**Strip these from qids and references:**

| Source artifact | DSL form |
|---|---|
| `[Q_Age]` (square brackets used as visual delimiters) | `QAge` — drop the brackets AND the underscore |
| `{QBrand}` or `<Gender>` (other delimiter styles) | `QBrand`, `Gender` — same idea |
| `Q1.a`, `Q1.b`, `Q1.c` (letter-suffix sub-questions) | `Q1a`, `Q1b`, `Q1c` — letter boundary is unambiguous, plain concatenation |
| **`Q1.1`, `Q1_1`, `Q10.3`** (digit-suffix sub-questions) | **`Q1x1`, `Q1x1`, `Q10x3`** — insert `x` because naïve stripping (`Q11`, `Q103`) collides with sibling qids |
| `Q1-a`, `Q1/a` (hyphens / slashes — letter boundary) | `Q1a` |
| `Q1-1`, `Q1/2` (hyphens / slashes — digit boundary) | `Q1x1`, `Q1x2` — same `x`-substitution |
| `Q_Brand_Awareness` (underscores at word boundaries) | `QBrandAwareness` — camelCase merge, no `x` needed |
| `Q1*`, `Q1!`, `Q1 (revised)` | `Q1` — drop trailing annotations; flag the meaning in delta-log if needed |
| Leading / trailing whitespace, bold / italic markup | strip — never embed Markdown / Word formatting in the qid |

**Use `x` between digits, camelCase between words.** A qid like `Q1.1` (sub-question 1.1) stripped naïvely becomes `Q11` — which collides with question `Q11` in the same survey. **Insert `x` at digit-to-digit boundaries: `Q1.1` → `Q1x1`, `Q1_1` → `Q1x1`, `Q10.3` → `Q10x3`.** At letter-to-letter or letter-to-digit boundaries plain concatenation / camelCase is unambiguous: `Q1.a` → `Q1a`, `Q_Brand_Awareness` → `QBrandAwareness`.

**No special characters in DSL identifiers.** Per the current design, qids, loop ids, page ids, block ids, and list names use letters and digits only — no underscores, dots, hyphens, brackets, or anything else. `Q_Age` becomes `QAge`, `S_zip` becomes `SZip`, `brand_loop` becomes `brandLoop`. Strip the special character; insert `x` when it sat between digits.

(Python identifiers inside `- script:` blocks follow Python convention — `is_premium_buyer()`, `helper_total = 0` are fine. The no-special-char rule applies to DSL identifiers, not to internal Python variable/function names.)

**Convert alphabetic option codes to numeric.** Hard Rule #2 — codes are numeric. The qnr's display labels (`a.`, `b.`, `c.`, …) are not codes; they're presentation order. Map them to `1`, `2`, `3`, … preserving the qnr's listed order.

```
Source:                       DSL:
[Q_Gender] What is your gender?     - qid: QGender
a.  Male                                type: single
b.  Female                              text: What is your gender?
c.  Non-binary                          options:
d.  Prefer not to answer                    1: Male
                                            2: Female
                                            3: Non-binary
                                            4: Prefer not to answer
```

Same rule for Roman-numeral codes (`i.`, `ii.`, `iii.`) and any other label scheme — they all collapse to `1`, `2`, `3`, … in the DSL. Preserve the source label text exactly; only the code number is the AI's invention.

**When a qid would still be invalid after stripping** (e.g. the qnr labels questions by pure number like `1`, `2`, `3`), prepend a prefix per the table above — `Q1`, `Q2`, `S1` for screeners. That's the only situation where adding a prefix is justified.

**Log every non-trivial normalization in the delta-log.** Dropping brackets is obvious; concatenating `Q1.a` into `Q1a` could surprise the stakeholder if they refer to it as "Q1 dot a" in conversation. Note it.

---

## 2. Question types — overview

| Type | What it collects | Notes |
|---|---|---|
| `info` | Nothing. Display-only. | No `required`, no `validation`, no `default.errors`. |
| `single` | One numeric code. | Supports `specify`, `exclusive`, `readonly`. |
| `multi` | Multiple numeric codes. | `min`/`max`/`exact` selection counts. |
| `rank` | Codes in user-chosen rank order. | `selected`/`values` preserve rank order. |
| `open` | One free-text string. | `style: text` or `textarea`. |
| `openList` | One free-text per row. | `min`/`max`/`exact` = answered-row count. |
| `number` | One numeric value. | `min`/`max` = numeric bounds. |
| `numberList` | One numeric per row. | `sum` constrains total; `total: True` shows running-total row. |
| `gridSingle` | Rows × columns; one scale code per row. | `style: grid` or `paired`. |
| `gridMulti` | Rows × columns; multiple scale codes per row. | `min`/`max`/`exact` = per-row count. |
| `gridNumber` | Numeric value per (row × column) cell. | Uses `rows:` and `cols:` keywords (not `options:` / `scale:`). **Both axes take inline numeric codes — `rows: { 1: Jan, 2: Feb }` — NOT a nested `rows: { options: listName }` shape.** |
| `mixGrid` | Transposed shared-row container; nested column qids. | Children: `single`, `multi`, `rank`, `openList`, `numberList`, `gridSingle`. |
| `lookup` | Record from external list asset. | Styles: `searchInput` (default), `dropdown`, `cascading`. |
| `cbc` | Per task: the concept chosen (choice mode), a scale code per concept (rating mode), or a rank position per concept (rank mode). | Choice-based conjoint from an uploaded design. Authored in full — §2.1. |
| `maxdiff` | Per set: the best item code and the worst item code. | MaxDiff from an uploaded design. Authored in full — §2.1. |

**Research-module types — do not author these in DSL:**
`cardSort`, `textAnnotation`, `imageAnnotation`, `videoAnnotation`. If the doc references one, leave a stub:

```yaml
- qid: QCardsort
    type: cardSort
    text: Drag each item into the category it best belongs to.
```

Then flag in delta-log: "Configure cards and buckets via the cardSort wizard."

`cbc` and `maxdiff` are **not** in that list — they are plain DSL, written in full (§2.1).

### 2.1 Conjoint — `cbc` and `maxdiff`

**There is no CBC or MaxDiff wizard. Write the question in full.** The only human task is uploading the design file in Assets → Designs; `design:` must equal that design's name there. If the brief does not give the name, use the design file's name without its extension and say in the delta-log that the design must be uploaded under that name. Never invent or retype a design matrix — versions, tasks, concepts, attribute levels, items and their labels all live in the uploaded file, not in the `.yml`.

```yaml
- qid: QCbc
    type: cbc
    text: Which of these would you buy?
    design: PlanDesign
    versionSource: systemBalanced
    noneOption: True
    noneLabel: None of these

- qid: QMaxDiff
    type: maxdiff
    text: Which matters most, and which least?
    design: FeatureDesign
    versionSource: systemBalanced
    bestLabel: Most important
    worstLabel: Least important
```

| Property | On | Meaning |
|---|---|---|
| `design` | `cbc`, `maxdiff` | Name of the design uploaded in Assets → Designs. Required. |
| `versionSource` | `cbc`, `maxdiff` | `systemBalanced` — the platform deals design versions evenly (the default to write). `systemRandom` — deals them at random. Use an expression instead only when the document asks for its own assignment, e.g. `versionSource: hVersion.value`. |
| `noneOption` / `noneLabel` | `cbc` | `noneOption: True` adds a "none of these" answer to every task; `noneLabel` is its text. |
| `responseMode` | `cbc` | `choice` (default) — one concept picked per task. `rating` — every concept rated on `scale:`. `rank` — the concepts ordered within the task. |
| `scale` | `cbc` | Code → label map for `responseMode: rating`, where it is required. Not used in the other modes. |
| `bestLabel` / `worstLabel` | `maxdiff` | Text of the two pick buttons (defaults: "Best" / "Worst"). |
| `followUp` | `cbc`, `maxdiff` | Comma-separated qids of questions asked inside each task (see "In-task follow-ups" below). |

A conjoint question takes **no** `options:`, `options.from:`, `group:`, `min` / `max` / `exact` — the concepts and items come from the design. `scale:` is valid on `cbc` in rating mode only, never on `maxdiff`.

```yaml
- qid: QCbcRate
    type: cbc
    text: How likely would you be to buy each of these?
    design: PlanDesign
    versionSource: systemBalanced
    responseMode: rating
    scale:
        1: Definitely would not buy
        2: Probably would not buy
        3: Might or might not buy
        4: Probably would buy
        5: Definitely would buy
```

**Reading the answers after the exercise** (in a `- script:`, an `if:`, or a pipe). `T` is the task number, `N` the concept's column, `A` the attribute's position in the design — all from 1.

| Read | Mode | What it is |
|---|---|---|
| `QCbc.task(T).selected` | choice | The concept chosen in task T, as a selection: 1 = first concept, 2 = second, …, **0 = the none option**. Test it with `.any([...])` — `if: QCbc.task(3).selected.any([1, 2])`, none is `.any([0])` — or compare it: `QCbc.task(3).selected != 0`. Never pipe it directly. |
| `QCbc.task(T).level(A)` | choice | The level of attribute A in the concept chosen in task T. `.any([2, 4])`, `.code` (the level number), `.label`, `.answered` (False when none was chosen). Pipes as the level's label: `{{ QCbc.task(3).level(1) }}`. |
| `QCbc.task(T).ratings(N)` | rating | The scale code concept N got. Compares as a number (`QCbc.task(1).ratings(2) >= 4`); also `.any([4, 5])`. |
| `QCbc.task(T).rank(N)` | rank | The position concept N got, 1 = top. |
| `QMaxDiff.task(T).best` / `.worst` | — | The item picked best / worst in set T. `.code` (the item code), `.label`, `.answered`, `.any([5, 6])`. Pipes as the item's text: `{{ QMaxDiff.task(2).best }}`. |

- **`level(A)` — not the column number — says WHAT was chosen.** The design shuffles concepts across columns, so "chose brand X in task 3" is `QCbc.task(3).level(1).any([2])` (level 2 of attribute 1), never a test on `.selected`.
- **To show or reuse the chosen column**, copy it into a hidden `single` whose options are `0:` (the none label), `1: A`, `2: B`, … with `hChoice.set(QCbc.task(3).selected)`, then pipe `{{ hChoice.selectedLabel }}`.
- **To store a rating or rank in a hidden `number`**, wrap it: `hRating.set(int(QCbc.task(1).ratings(2)))`.
- **There is no `.chosen`, `.value`, `.selectedLabel`, `.answered` or `.none`** on `QCbc` or on `QCbc.task(T)`.

**In-task follow-ups** ("why did you choose that?"). List them in `followUp:` on the `cbc` / `maxdiff`, and write each follow-up as its own `- qid:` block (`single`, `multi`, `open` or `number`) directly after the conjoint question. The platform shows a follow-up under the task once the task is answered, while the concepts are still on screen — never as a page of its own. Its `if:` decides where it is asked:

| Follow-up `if:` | Asked | Examples |
|---|---|---|
| No `task(T)` — reads the task being answered | On **every** task where the condition holds | `if: QCbc.selected.any([1, 2])` (0 = none) · `if: QCbc.level(1).any([2, 4])` · `QCbc.ratings(N)` · `QCbc.rank(N)` · `if: QMaxDiff.best.any([5, 6])` |
| Names `task(T)` | In task T **only** | `if: QCbc.task(3).selected.any([1, 2])` — once, in task 3, when the first or second concept was chosen there · `if: QMaxDiff.task(2).best.answered` — in set 2 |
| No `if:` | On every task | |

```yaml
- qid: QCbc
    type: cbc
    text: Which of these would you buy?
    design: PlanDesign
    versionSource: systemBalanced
    noneOption: True
    noneLabel: None of these
    followUp: QWhyNone, QWhyThird

- qid: QWhyNone
    type: open
    text: Why did none of these appeal to you?
    if: QCbc.selected.any([0])

- qid: QWhyThird
    type: open
    text: What made you pick the {{ QCbc.level(1) }} option?
    if: QCbc.task(3).selected != 0
```

- Follow-up text can pipe the task being answered: `{{ QCbc.level(1) }}` (the chosen level's label), `{{ QMaxDiff.best }}` (the item's text). It **cannot** pipe a hidden question set by a script — scripts run only after the whole exercise.
- A document that asks about one particular choice ("thinking about the third choice…") is an in-task follow-up with `task(T)`.
- Follow-up answers are exported per task and **cannot be read by later logic**. When later routing depends on the answer, ask it as an ordinary question after the exercise instead, reading `QCbc.task(T)` as above.

---

## 3. Question properties — by category

### 3.1 Identity & display (all types)

| Property | Notes |
|---|---|
| `qid` | Required. Unique. |
| `type` | Required. One of the canonical types. |
| `title` | Short label shown in nav/structure. |
| `text` | Main question stem. **Pipe-aware: `{{ Q.value }}`**. |
| `instruction` | Sub-text shown below the stem. Pipe-aware. |
| `title.format` / `text.format` / `instruction.format` | Format strings. |
| `style` | Per-type display style — see §4. |
| `visibility` | `show` (default) / `hide`. Persistent override. |
| `if` | Python-subset expression — show when `True`. |

### 3.2 Choices & scale

| Property | Applies to | Notes |
|---|---|---|
| `options` | `single`, `multi`, `rank`, `openList`, `numberList`, `gridSingle`/`Multi` (rows), `mixGrid` | Inline coded list **or** name of a reusable list. |
| `group` | same as `options` (except `mixGrid`) | Inline grouped coded list **or** name of a reusable grouped list. |
| `scale` | `gridSingle`, `gridMulti` | Column scale items. |
| `rows` | `gridNumber` | Row domain (accepts an `options:` or `group:` list). |
| `cols` | `gridNumber` | Column domain (accepts a `scale:` list). |
| `options.from` | same as `options` | Runtime expression returning visible subset (mask). |
| `scale.from` | grids | Runtime expression returning visible scale subset. |
| `group.order` | types with `group` | Order of groups themselves. |

**Mask vs. order:** masking decides *which* codes show; **authored order** governs display sequence. `order: random` applies on top of the visible subset. `.all` returns the full authored domain regardless of mask.

**`options.from:` requires a companion `options:` or `group:`.** The mask is a filter on an explicit domain — on its own it declares no response space, so the validator fires `options-from-domain-required`. Pair it: `options: streamingBrands` + `options.from: q2BrandsUsed()` is the canonical shape. Same rule holds on loops (§6.3).

**Masking rule:** when a question uses `options.from:` / `scale.from:`, define the helper function in a `- script:` placed **immediately above** the consuming question, and **gate the question with `if: len(helper()) > 0`** so it's skipped when the mask returns empty. A required question with no options strands the respondent — they can't proceed and can't answer. Skip the question instead. (The `if:` predicate uses the same helper the mask uses, so there's a single source of truth for "should this render at all".)

```yaml
- script: |
    # Visible-row helper for StreamUse: only services the respondent currently uses.
    def currently_used_svods():
        result = []
        for code in SvodExperience.all:
            v = SvodExperience.row(code).value
            if v is not None and toInt(v) == 5:
                result.append(code)
        return result

- qid: StreamUse
    type: gridSingle
    if: len(currently_used_svods()) > 0
    options.from: currently_used_svods()
    options: streamingServices14
    scale: useFreqScale9
    required: True
    text: About how often do you use each of the following streaming services?
```

### 3.3 Layout & input

| Property | Applies to | Notes |
|---|---|---|
| `layout.cols` | `single`, `multi`, `rank`, `openList`, `numberList`, grids | Display column count. |
| `label.position` | `openList`, `numberList`, grids | `default` / `left` / `right`. Default `left`. |
| `label.prefix` / `label.suffix` | `single`, `multi`, `openList`, `numberList`, `number` | Affixes. |
| `input.size` | `open`, `openList`, `number`, `numberList` | Input field width. |
| `input.rows` | `open` | Textarea row count. |
| `input.maxChar` | `open`, `openList` | Max character cap. |
| `input.min_char` | `open`, `openList` | Min character requirement (snake_case). |
| `input.header` | `numberList` | Column header above inputs. |
| `input.source` | `open`, `number`, `openList` | `js` (JS-fed) / blank (respondent). Pair with `readonly: True`. |

### 3.4 Constraints

| Property | Applies to | Notes |
|---|---|---|
| `min` | `multi`, `rank`, `gridMulti`, `openList` (count); `number`, `numberList` (numeric bound) | Type-dependent meaning. |
| `max` | same | same |
| `exact` | `multi`, `rank`, `gridMulti`, `openList` | Selection-count only. |
| `sum` | `numberList` | Validation-only. Does NOT auto-show total row. |
| `total` | `numberList` | `True` to show running-total display row. |
| `required` | all except `info` | `True` requires response before advancing. |
| `validation` | all except `info` | Python block; call `fail("...")`. |

### 3.5 Display control

| Property | Applies to | Notes |
|---|---|---|
| `decimal` | `number`, `numberList` | `True` allows decimals. |
| `decimal.places` | `number`, `numberList` | Integer precision. |
| `readonly` | all | `True` for display-only / JS-fed / safe preview. |
| `default.errors` | all answer-bearing | **Boolean only.** `True` (use system error message) / `False` (suppress). No custom-string form — for custom wording, set `default.errors: False` and own the message via `validation: \|` + `fail("your text")` / `fail(QErrMsg.row(N).label)`. A non-True/False value parses to True (never echoed as the error text). |

### 3.6 Order

| Property | Applies to | Values |
|---|---|---|
| `order` | most types, `loop`, `page`, `block` | keyword — `fixed` / `random` / `randomEach` / `flip` / `alphabetical` / `reverse` — **or an expression** (engine v3.38.0+) |
| `group.order` | types with `group` | keyword only (expression form deferred) |
| `scale.order` | grids | same forms as `order:` |

Keyword semantics: `fixed` = authored order. `random` = stable random for the visible domain. `randomEach` = re-rolls per show. `flip` = deterministic split-sample (assigned once per respondent). `reverse` = forced reversed. `alphabetical` = author cautiously.

**Expression form (engine v3.38.0).** `order:` and `scale.order:` accept any expression resolving to an ordered code list — the same evaluator `options.from:` already uses. The value is a keyword iff it exactly matches one of the six reserved words above; anything containing expression syntax (`. ( ) [ ] ,`) is parsed as an expression. Forms:

```yaml
# accessor — shown order of another question
order: Q1.all

# selections, in shown order
order: Q1.selected

# method chain (ordered union: Q1 first, then Q2's new ones, deduped)
order: Q1.all.union(Q2.selected)

# def-function returning a set / list
order: myOrder()

# literal code list
order: 4,2,3,1

# captured hidden (hOrder.rows pattern)
order: hOrder.rows
```

**Semantics of the expression form:**

- **Sequence only, not membership.** `*.from:` picks which codes appear; `order:` sequences whatever the membership is. When both are present, membership comes from `*.from` and sequence from `order`. When only `order:` is present, it sequences the authored domain.
- **Anchors + `isolate:` opt-outs excluded** from the orderable set. Anchors stay pinned; isolate codes never participate (and never produce loop iterations).
- **Dedup** — first occurrence wins; later duplicates ignored.
- **Unknown codes** — a code in the list that isn't a current member places nothing.
- **Unlisted members** — a current member not named by the list is appended after, in its current order (authored, or `*.from`'s returned order).
- **Unresolved dependency** → falls back to authored order (same catch behavior as `options.from:`). Applies once the dependency resolves.
- **Empty resolve** → unlisted-members rule appends everything in current order (= authored). `order:` never changes membership.
- **Deterministic** — no RNG; editor-preview and respondent engine produce byte-identical sequences for the same answers.

**Grouped questions.** `group.order:` sequences the groups; `order:` sequences options **within each group** (options can't leave their group — a cross-group code list is matched per group). An `anchor: True` group stays pinned.

**v3.38.0 behavior-change note (random-order consistency).** The respondent render used to carry a DUPLICATE shuffle on top of the engine's one, silently breaking carry-forward (`Q.all` / `Q.selected` and the respondent's displayed order didn't match). The duplicate is removed. For most surveys this is transparent — `random` is still stable per respondent, `randomEach` is still re-rolled per show. The one visible change: a **piped subset** (`options.from: QParent.selected`) now **inherits the parent's shown order** instead of being independently reshuffled. This is research-methodology correct, but a survey that depended on the old independent reshuffle will see displayed order shift (data is unaffected — stored by code).

**Where to put `order:` with a piped subset — the one bright line:**

| Surface | Need `order: Q.all` with `options.from: Q.selected`? |
|---|---|
| **Question** (`multi` / `single` / `rank` / `openList` / `numberList` / grid rows) | **No — redundant.** The piped subset auto-inherits the parent's shown order (engine v3.38.0). Adding `order: Q.all` produces an identical sequence; it's harmless but noisy. |
| **Loop** (`- loop:` with `options.from:`) | **Yes.** Loops historically ignored the source's shown order; `order: Q.all` is the switch that makes iterations follow the shown order. |
| **Block** (`- block:` imposing a stored sequence on children) | **Yes.** There's no auto-inherit path for sibling blocks — `order: hBlockOrder.rows` imposes the sequence explicitly. |

Reach for the expression form on **loops and blocks**. On a question with `options.from:`, drop it — leave the question clean and let the engine inherit.

### 3.7 Conditions

| Property | Applies to | Notes |
|---|---|---|
| `if` | all questions and flow blocks | Python-subset expression. |
| `visibility` | all | `show` / `hide` override. |

### 3.8 Per-entry properties (under each numeric option/row/scale code)

| Property | Notes |
|---|---|
| `label` | Display text (required when expanding entry to a map). |
| `label.format` | Format string. |
| `image` | URL/string (cards, image grids, loop concept images). |
| `anchor` | `True` — pin under `order: random`. |
| `exclusive` | `True` — selecting clears all others. **Multi-only.** Valid on `multi` options and `gridMulti` rows/scale entries. **Not valid on `single` options** — the validator rejects it (`single` already has one-selection semantics; an exclusive "Prefer not to answer" anchor is just an `anchor: True` option). |
| `specify` | `True` — attach free-text entry. Valid on `single` options, `multi` options, and **`gridNumber` rows** (not cols — cols are a plain axis). Row-level specify on gridSingle / gridMulti follows the same rule. |
| `specify.size` / `specify.maxChar` | Specify-input sizing. |
| `inactive` | `True` — cell inactive (grid types). |
| `data` | Object-like metadata payload. |
| `min` / `max` / `decimal` / `decimal.places` | Per-row override (`numberList`). |
| `label.prefix` / `label.suffix` | Per-row affixes on `numberList` row entries. **Not valid on `openList` option entries** — the validator rejects it. Affixes on `openList` are question-level only (or bake the prefix into the row's `label:`). |
| `input.size` / `input.maxChar` / `input.min_char` | Per-row input overrides. |
| `left.label` / `right.label` | `gridSingle` paired-style anchors. **Live on row option entries**, not on scale entries — the validator rejects them on scale entries. Each row entry declares its own left/right anchor pair, the scale entries are just the four (or N) intensity buckets between them. |
| `isolate` | `True` — mark this entry as an **opt-out** ("Prefer not to answer" / "None of the above" / "N/A"). Renders as a **checkbox toggle outside the question body**. Checking it clears + disables the question's inputs, skips validation, and counts as answered. See §3.10 for the full contract. Typically paired with `exclusive: True` (server-enforced clear). Live contract accepts on: `multi` options, `rank` options, `openList` / `numberList` row overrides, `gridSingle` / `gridMulti` rows, `gridNumber` rows AND cols, and the scalar-only `options:` block on `number` / `open` / `lookup`. **Not (yet) valid on `single` options** — for a `single` opt-out use a plain `anchor: True` option; validator fires `invalid-entry-prop` on `isolate` in a `single`. |

### 3.10 Opt-out entries — `isolate: True`

The canonical "this doesn't apply / Prefer not to answer / None of the above" opt-out. Prefer `isolate: True` for new opt-outs; the old "anchored + `exclusive: True` inside the main options" pattern still works on `multi` but doesn't get the split-render, skip-validation, or companion-column treatment.

**Author syntax — types with an `options:` choice / row list** — add the entry in place. Live contract accepts `isolate:` on: `multi`, `rank`, `openList` (row overrides), `numberList` (row overrides), `gridSingle` rows, `gridMulti` rows.

```yaml
- qid: QAreas
    type: multi
    text: Which areas of the lab do you work in?
    options:
        1: Clinical microbiology
        2: Clinical chemistry
        3: Hematology
        99:
            label: Prefer not to answer
            isolate: True
            exclusive: True     # server-enforced clear-others
```

**`single`**: not yet supported for `isolate:`. Use a plain `anchor: True` option for opt-outs on `single`:

```yaml
- qid: QBrand
    type: single
    options:
        1: Brand A
        2: Brand B
        99:
            label: Prefer not to answer
            anchor: True        # NOT isolate: True — validator rejects it on single
```

**Scalar / no-list types** (`number`, `open`, `lookup`): introduce an isolate-only `options:` block alongside the scalar constraints.

```yaml
- qid: QAge
    type: number
    text: What is your age?
    min: 1
    max: 99
    options:
        99:
            label: Prefer not to answer
            isolate: True
            exclusive: True
```

**gridNumber** (only type with symmetric axes): the opt-out lives in `rows:` or `cols:` as an axis entry.

```yaml
- qid: QBudget
    type: gridNumber
    rows:
        1: Housing
        2: Food
        98:
            label: N/A
            isolate: True
            valued: False
    cols:
        1: Jan
        2: Feb
```

**Multiple opt-outs** are allowed — e.g. `98: Not applicable` + `99: Prefer not to answer`. They render stacked and are mutually exclusive to each other.

**What activating the toggle does:**

1. Clears the axis's answer (row inputs / cells / selection / scalar value).
2. Disables those inputs while the toggle is checked; unchecking re-enables them.
3. Skips validation for that question — `required`, `min` / `max`, `atleast`, `exact`, `sum`, required-rows are all bypassed. The opt-out counts as answered.
4. Mutually exclusive with a real answer and with other opt-out entries.
5. Enforced both client-side (immediate UX) and server-side (authoritative; a direct API submit can't store both).

**Runtime accessors — isolate-aware:**

| Expression | Behaviour |
|---|---|
| `Q.selected` | **Excludes** isolate codes — the isolate is not a selection, it's a separate signal. Standardized across all types. |
| `Q.answered` | **True whether the respondent answered normally OR picked the opt-out.** This is the recommended way to gate "did they respond at all?" — no separate opt-out accessor needed for typical logic. |
| `Q.all` | **Excludes** isolate options from the returned domain — so `options.from: OtherQ.all` never drags an opt-out code along. |
| `options.from` masking | Isolate options are **pinned past `options.from`** — an isolate entry survives regardless of whether the mask expression returns its code (analogous to `anchor: True` pinning position, but here pinning membership). |

**Export column:** the opt-out selection is written to a companion column named `<qid>o<code>` (no underscore) — e.g. `S1o99 = 1`. The question's normal columns go null when opted out.

**When to use `isolate: True` vs `exclusive: True` alone:**

| Situation | Pattern |
|---|---|
| A dedicated "Prefer not to answer" / "None of the above" that should live outside the choice list, skip validation, and export as a separate column | `isolate: True` (+ usually `exclusive: True`) |
| A regular `multi` option that only clears siblings when clicked (e.g. "None of these" that's still a normal option semantically, no split-render needed) | `exclusive: True` alone on the multi option, no isolate |
| A `single`-question anchor for "Prefer not to answer" without opt-out semantics | Plain `anchor: True` option — `exclusive:` is invalid on `single` |

### 3.9 Group-level properties

| Property | Notes |
|---|---|
| `show.label` | `True` / `False` — render the group heading. |
| `anchor` | `True` — pin the group's position. |
| `options:` | The grouped option entries (nested). |

---

## 4. Per-type style values

Canonical names from the live renderer's skin matrix. **Style names are camelCase** — `imageCards`, NOT `image_cards`. The syntax validator does NOT exhaustively enforce per-type style enums, so a typo silently renders the default skin. Verify the exact skin name against the renderer's matrix before fielding.

| Type | Styles |
|---|---|
| `single` | `radio`, `dropdown`, `buttons`, `cards`, `imageCards` |
| `multi` | `checkbox`, `buttons`, `cards`, `imageCards`, `dropdown` |
| `rank` | `arrows`, `tapToRank`, `dropdownRank`, `podium`, `drag` |
| `open` | `text`, `textarea` |
| `openList` | `input` (default) |
| `number` | `input`, `slider`, `sliderTicks`, `stepper`, `dial`, `dropdown` |
| `numberList` | `input`, `slider`, `sliderTicks`, `stepper`, `dropdown` |
| `gridSingle` | `radioGrid` (default), `paired`, `scaleButtons`, `cardStack`, `emojiScale`, `sliderGrid`, `bipolarSlider`, `scaleBar` |
| `gridMulti` | `checkboxGrid` (default), `cardStack`, `chipGrid` |
| `gridNumber` | `grid` (default), `number`, `dropdown` |
| `mixGrid` | `desktop_style` / `mobile_style` strings |
| `lookup` | `searchInput` (default), `dropdown`, `cascading` |
| `info` | (none) |

**Image rendering on `cards` vs. `imageCards`:** `style: cards` works with or without `image:` per option — when `image:` is present, the card displays the image alongside the label. `style: imageCards` is a stricter image-first skin where the image dominates the card. Pick `imageCards` when the image IS the choice (concept testing, package designs); pick `cards` when the label is primary and the image is supportive.

---

## 5. Reusable lists — `- lists:`

### 5.1 When to extract a list

**Rule of thumb: if the same core list appears in 2+ places, define it once in `- lists:` and reference by name.**

**Nuance — boilerplate doesn't disqualify:** options like `Other (specify)`, `Other`, `Don't know`, `None of these`, `Prefer not to say` mixed in with the brand list don't break reusability. The "core" of the list (the actual brands / items / categories) is what matters. If you see the same core list across questions, extract it. Boilerplate ends-of-list:

- can live **inside** the named list (most common — every consumer gets the same opt-out behavior), or
- can be **added inline at the reference site** when only some consumers need the extra entry (see §5.5).

Conventional codes for boilerplate:

| Code | Meaning |
|---|---|
| `97` | Other (with `specify: True`) |
| `98` | Don't know |
| `99` | None of these / Prefer not to say (with `anchor: True`, often `exclusive: True` for `multi`) |

### 5.2 Where it lives

`- lists:` is a top-level block. **Place it at the bottom of the file**, after the questions. Long lists at the top push the actual question code far down and make the survey hard to scan. Multiple `- lists:` blocks are allowed (e.g. one for brands, one for demos).

### 5.3 The named-entry shape

Each entry inside `- lists:` is a **name** (your choice, valid identifier, unique) followed by a body declaring exactly one of `options:`, `group:`, or `scale:`.

```yaml
# top of file — questions reference the named list
- qid: QFavRetailer
    type: single
    text: Which retailer do you visit most often?
    options: retailBrandsSingle

- qid: QStoresVisited
    type: multi
    text: Which stores have you visited?
    options: retailBrandsSingle    # same list, different question
    min: 1

# bottom of file — list definitions
- lists:
    retailBrandsSingle:
        options:
            1: Target
            2: Walmart
            3: Costco
            4: Kroger
            5: Aldi
            97:
                label: Other
                specify: True
            99:
                label: None of these
                exclusive: True
                anchor: True

    satisfactionScale:
        scale:
            1: Very dissatisfied
            2: Dissatisfied
            3: Neutral
            4: Satisfied
            5: Very satisfied

    storeGroups:
        group:
            Grocery Stores:
                show.label: True
                options:
                    11: Aldi
                    12: Kroger
            Warehouse Clubs:
                show.label: False
                options:
                    21: Costco
                    22: Sam's Club
```

`exclusive: True` on `99` only does anything on `multi` consumers; on `single` and `rank` it's a no-op. One list, many questions, one consistent opt-out.

### 5.4 Reference forms

```yaml
# Flat options
options: retailBrandsSingle

# Grouped
group: storeGroups

# Scale (grid columns)
scale: satisfactionScale

# gridNumber uses different keywords
rows: spendCategories
cols: quarters
```

### 5.5 Adding options on top of a list reference

When *most* questions share a list but one or two need an extra entry, extend at the reference site — author the list name on the `options:` line and add extras as indented children.

```yaml
- qid: QDigital
    type: multi
    text: Which digital retail features have you used?
    layout.cols: 1
    order: random
    options: digitalFeatures
        99:
            label: None of these
            exclusive: True
            anchor: True

# bottom of file
- lists:
    digitalFeatures:
        options:
            1: Mobile app shopping lists
            2: Digital coupons
            3: Order pickup
            4: Delivery
            5: Pharmacy refill reminders
```

The base list stays clean (5 real options); `QDigital` gets the opt-out. Other consumers of `digitalFeatures` aren't affected. If the addition is needed *everywhere*, put it inside the list itself instead.

### 5.6 Error messages — **always** route through a hidden `QErrMsg` multi

> **A message that includes a number worked out in the validation** ("You have 85.") keeps its static sentence in the bank and adds the piped part in the call: `fail(QErrMsg.row(6).label + " You have {{ total }}.")`. The variable exists only inside the validation, so `{{ total }}` cannot be written in the bank's option label (§9).

**House standard:** every `fail(...)` call uses the `QErrMsg.row(N).label` pattern. Never inline literal strings inside `fail("...")`. The message goes in a reusable `errMessages` list referenced by a hidden `QErrMsg` multi; `fail()` pipes the label by code.

**Why:** every error string is a translation target. Hunting strings across dozens of `validation:` blocks at translation time is painful and error-prone. Centralising them in one list means the translator works in one place, the copy reviewer works in one place, and changing wording is one edit.

```yaml
- qid: QPartnerName
    type: open
    text: Partner's name
    validation: |
        if QPartnerName.value.strip() == "":
            fail(QErrMsg.row(1).label)

- qid: QZip
    type: open
    text: ZIP code
    default.errors: False
    validation: |
        if not re.fullmatch(r"\d{5}", QZip.value):
            fail(QErrMsg.row(2).label)

# hidden message bank — sits anywhere, never renders
- qid: QErrMsg
    type: multi
    visibility: hide
    text: Validation error messages
    options: errMessages

# bottom of file
- lists:
    errMessages:
        options:
            1: Please enter your partner's name.
            2: Please enter a valid 5-digit ZIP code.
            3: Please enter a valid email address.
            4: Allocations must sum to exactly 100.
```

`QErrMsg` never renders (`visibility: hide`), but its option labels are readable from any validation block via `QErrMsg.row(N).label` — `multi.row(code)` returns an entry proxy that exposes `.label` whether or not the option is selected. Edit the list once, every `fail` that references it picks up the new copy. Translators get a single place to work.

---

## 6. Flow blocks

### 6.1 `- page:` — the screen unit, only when grouping is required

**Rule:** use `- page:` **only** when the questionnaire requires two or more questions to render together on the same screen (e.g., `[SAME PAGE AS PREVIOUS]` annotations, or visually-grouped demographic clusters). When a question stands alone, write it at the top level — **do not wrap a single question in a page just for structure**. Standalone questions are already one-screen units; the wrapper adds noise.

A page is one screen. The respondent fills in every question on the page, then clicks Next.

**A page contains only `- qid:` items (under `questions:`) or nested `- page:` items (no wrapper).** No `- block:`, no `- loop:`, no `- if:` flow blocks, no `- script:`, no `- note:` inside a page. Anything else lives in the flow *around* the page.

For visibility on a single conditional question, put `if:` directly on the question — no page wrapper needed:

```yaml
- qid: WorkStyle
    type: multi
    if: EmployStatus.selected.any([1, 2]) and Age.value > 17
    text: Which of the following best describe/s your work situation?
    ...
```

For sequential questions sharing the same condition, use a `- if <expr>:` flow block (not a page):

```yaml
- if Age.value >= 18:
    - qid: TypingTool1
        type: gridSingle
        ...
    - qid: TypingTool2
        type: gridSingle
        ...
```

```yaml
- page:
    id: demographics
    title: A few quick details
    if: True
    order: fixed
    questions:
        - qid: QAge
            type: number
            text: How old are you?
            min: 13
            max: 120
        - qid: QGender
            type: single
            text: Gender
            options:
                1: Female
                2: Male
                3: Non-binary
                4: Prefer not to say
```

**Nested pages** sit directly under the parent (no `questions:` wrapper between them):

```yaml
- page:
    id: brandChapter
    title: Brand impressions
    if: QSegment.value == 1
    - page:
        id: brandApple
        title: Apple
        questions:
            - qid: QAppleAware
                type: single
                text: Have you heard of Apple?
                options:
                    1: Yes
                    2: No
    - page:
        id: brandSamsung
        title: Samsung
        questions:
            - qid: QSamsungAware
                type: single
                text: Have you heard of Samsung?
                options:
                    1: Yes
                    2: No
```

### 6.2 `- block:` — structural grouping

Allowed children: `question`, `page`, `block`, `loop`, `if`/`elif`/`else`. **`script:` inside a block is out of contract** — keep scripts at top-level.

```yaml
- block:
    id: brandSection
    title: Brand questions
    if: QScreen.selected.any([1, 2])
    order: random
    questions:
        - qid: QBrandAware
            ...
```

`block.order:` accepts a keyword OR an **expression** (engine v3.38.0+). The expression resolves to an ordered list of child-block ids, so you can impose a stored sequence (e.g. a captured `hBlockOrder.rows` of `[2, 4, 1, 3]`) on the children — each child block is kept together (its internals keep their defined order) and child blocks are traversed in the resolved sequence. See §3.6 for the full semantics.

### 6.3 `- loop:` — iterate

**Loops are control-flow (repeated mixed content — questions, scripts, logic), NOT a display group.** Their body is written as **DIRECT children** with no `questions:` wrapper, exactly like `if` / `elif` / `else`. This lets `- script:` live inside a loop for per-iteration logic. The validator emits `loop-questions-not-allowed` if you use `questions:` on a loop.

```yaml
- loop:
    id: brandLoop
    options: brandList
    options.from: QBrand.selected
    - qid: QRating
        type: number
        text: Rate {{ brandLoop.selectedLabel }} out of 10.
        min: 0
        max: 10
    - qid: QWhy
        type: open
        text: Why did you give that rating?
        if: QRating.value < 4
    - script: |
        # Per-iteration side effect. Runs once per iteration in that
        # iteration's context — bare qids resolve to this iteration.
        if QRating.value is not None and QRating.value < 4:
            hLowRaters.row(brandLoop.value).set(1)
```

Properties (direct props):

| Property | Notes |
|---|---|
| `id` | Required. Unique across all loops in the survey. Becomes the **loop variable name**. Duplicate ids fire `duplicate-loop-id` (iterations key by id and exports derive loop columns from it — two loops sharing an id merge their data). |
| `options:` | Inline coded list — the loop's full iteration domain (full-domain disclosure, used for exports and label resolution). |
| `options.from:` | Runtime mask — Python expression returning the visible subset of codes to iterate over (most common: looping over a previous selection). **Requires a companion `options:` or `group:` on the same loop.** |
| `group:` | Reusable named grouped list — alternative to `options:` for full-domain disclosure. |
| `order:` | Keyword (`fixed` / `random` / `randomEach` / `alphabetical` / `reverse` / `flip`) **or an expression** (engine v3.38.0+). The expression form is how you make a follow-up loop iterate in a parent question's shown order — e.g. `options.from: QBrand.selected` + `order: QBrand.all` iterates picked brands in the order they appeared, not in authored/click order. See §3.6. |

**Required combinations:** `options.from:` is a mask only — it does **not** stand alone. Pair it with a companion `options:` (or `group:`) on the same loop so the full response domain stays explicit (needed by exports + label resolution). Valid forms:

- `options:` alone — fixed iterations, full domain = iteration domain.
- `options:` + `options.from:` — fixed full domain, runtime-filtered iteration subset.
- `group:` + `options.from:` — grouped full domain, runtime-filtered iteration subset.

**Invalid:** `options.from:` alone fires `options-from-domain-required` from the validator. This mirrors the identical rule on question-level `options.from:` (§3.2).

**Allowed children (direct, not under `questions:`):** `question`, `page`, `block`, `loop` (nested), `if` / `elif` / `else`, `script`, `custom`, `note`.

**Loop variable accessors** (named after the loop's `id`):

| Expression | Returns |
|---|---|
| `loopId.value` | Current iteration's code |
| `loopId.selectedLabel` | Current iteration's label (most common pipe target) |
| `loopId.all` | All iteration codes for this respondent |
| `loopId.allLabels` | Labels for `.all` |
| `loopId.at` | 1-based position of the current iteration |
| `loopId.size` | Total iterations |

**Inside the loop body, references resolve to the current iteration automatically:**

```yaml
- qid: QWhy
    type: open
    if: QRating.value < 4   # this iteration's QRating
```

**Cross-iteration access** uses the **trailing-underscore (`Qx_`) accessor** — never bare brackets on the qid. The runtime pre-builds a `Qx_` bracket accessor for every loop-scoped question. qids forbid underscores in their identifier (`[A-Za-z][A-Za-z0-9]*`), so the trailing `_` is unambiguous.

**Static form** — code known at author time, written as a compound identifier `qid_code`:

```python
# Apple's rating, regardless of current iteration
if QRating_1.answered:
    hBestBrand.set(QRating_1.value)

# Nested loop (outer code 1, inner code 10)
v = QRating_1_10.value
```

**Dynamic form** — code in a variable, use the bracket accessor on `qid_`:

```python
# Single loop
for c in brandLoop.all:
    total = total + (QRating_[c].value or 0)

# Nested loop — chained brackets bind outermost level first
for b in marketLoop.all:
    for a in attrLoop.all:
        v = QRating_[b][a].value
```

**`q("baseName", code)` — dynamic qid lookup by name.** When both the prefix *and* the code come from variables (typical of derotation punch loops), the `q()` runtime helper concatenates `baseName + code` and returns the matching question proxy (or `null`).

```python
# q("Q1Concept", 3)  →  resolves to the Q1Concept3 question proxy
q("Q1Concept", c).set(Q1.value)

# q("Q1Concept")  →  resolves to the bare Q1Concept question
```

**Empty loops** (when `options.from` resolves to empty) are skipped silently — no rendering, no error. Guard upstream when an empty source is plausible.

**Inline derotation punch — the preferred pattern.** A `- script:` placed at the end of the loop body runs once per iteration in *that iteration's context*, so bare qids resolve to the current iteration's answers and `<loopId>.value` gives the current code. This is the cleanest place to punch derotation slots — see §16.13 for the full pattern.

```yaml
- loop:
    id: conceptLoop
    options: conceptList
    options.from: hConcept.selected
    - qid: Q1
        type: single
        options: appealOptions
        text: How appealing is {{ conceptLoop.selectedLabel }}?
    # ... other loop questions ...

    - script: |
        # Inline punch — runs once per iteration in its own context.
        # Bare Q1 = this iteration's answer; conceptLoop.value = current code.
        iter = conceptLoop.value
        if Q1.answered:
            q("Q1Concept", iter).set(Q1.value)
```

Use the post-loop `Q1_[c]` form (see Cross-iteration access above) only when the punch logic needs to span multiple loops or has to run outside the iteration scope. The interpreter now keys loop-member answers per iteration correctly (v3-era fix), so post-loop `Q_[c].value` / `q("Q", c).value` reads for derotation work reliably.

**Use the type-precise accessor in punches.** AI authoring should pick the accessor that matches the question type — not the most-general one. Humans may write `.selected` on a single because the runtime accepts it, but AI should be explicit:

| Question type | Punch read | Punch write |
|---|---|---|
| `single` | `Q.value` | `target.set(Q.value)` |
| `open` | `Q.value` | `target.set(Q.value)` |
| `number` | `Q.value` | `target.set(Q.value)` |
| `multi` | `Q.selected` | `target.set(Q.selected)` |
| `rank` | `Q.values` (ordered) | `target.set(Q.values)` |
| `gridSingle` row | `Q.row(c).value` | `target.row(c).set(Q.row(c).value)` |
| `gridMulti` row | `Q.row(c).selected` | `target.row(c).set(Q.row(c).selected)` |
| `lookup` (single) | `Q.value` | `target.set(Q.value)` |
| `lookup` (multi) | `Q.values` | `target.add(v)` per element |

### 6.4 Conditional flow

```yaml
- if QAge.value < 18:
    - script: |
        endSurvey("terminate", TermPage)     # TermPage is an end page — §6.7
- elif QAge.value >= 65:
    - qid: QSeniorIntro
        type: info
        text: Welcome — this section covers your retirement experience.
- else:
    - qid: QGeneralIntro
        type: info
        text: Welcome.
```

Nestable inside `block:` and `loop:`. Not allowed inside `page:`.

#### Prefer `- if` flow blocks over inline `if:` for shared gates

When two or more consecutive questions share the same gate condition, **wrap them in a `- if <expr>:` flow block** instead of repeating an inline `if:` property on each one. The flow-block form reads as a single guarded section; the inline form forces the reader to verify that every question's `if:` matches.

```yaml
# ✅ Good — one flow gate covering five US-only screener questions.
- if hCountry.value == 1:
    - qid: SHispanic
        type: single
        text: Are you of Hispanic or Latin origin?
        ...
    - qid: S6
        type: single
        text: Which of the following best describes your ethnic background?
        ...
    - qid: S7
        type: single
        text: Which of the following ranges includes your total annual household income before taxes?
        ...
```

```yaml
# ❌ Repetitive — same gate copy-pasted onto each question.
- qid: SHispanic
    if: hCountry.value == 1
    ...
- qid: S6
    if: hCountry.value == 1
    ...
- qid: S7
    if: hCountry.value == 1
    ...
```

**When inline `if:` is still the right call:**
- A single, one-off conditional question (no neighbours sharing the same gate)
- The gate condition differs per question (one needs `c == 1`, the next `c == 1 or c == 3`)
- The question lives inside a `- page:` (which can't host a flow block — use inline `if:`)

Default to **`- if`** when ≥2 consecutive questions share a gate. Use **inline `if:`** for one-offs or when flow blocks aren't available. The flow-block form keeps debugging fast — one place to change the condition, one place to read it.

### 6.5 `- script: |` — Python at the top level

Top-level executable Python-subset block. Use for derived flags, prefilling hidden questions, masking helpers, branching helpers, and screenout/complete routing.

```yaml
- script: |
    # Terminate under-18s and tag the spender segment for downstream routing.
    # hSegment is a hidden single: 1 = premium, 2 = standard (codes are numbers).
    if QAge.value < 18:
        endSurvey("terminate", TermPage)     # names its end page — §6.7
    if QSpend.value > 100:
        hSegment.set(1)
    else:
        hSegment.set(2)
```

#### Scripts execute on traversal — placement IS timing

Scripts run when the respondent's flow traversal reaches their document position, **in document order**. There is no batch pre-pass and no implicit reordering. Where you place a script *is* when it runs.

This makes placement semantic, not stylistic. **A script must sit between its inputs and its consumers in document order, so that by the time traversal reaches a consumer, the script has already populated the state the consumer reads.**

| Script kind | Place it... |
|---|---|
| **Punches a hidden question** from previous selections (or any source) | **Immediately BEFORE the hidden question's definition.** Define the hidden destination right after its punch — the script writes, the destination follows, and the pair is co-located. |
| **Derives a value from a recently-answered question** (`hRaceRecode` from `Race`, `hSegment` from `QAge` × `QSpend`) | **Between the source and the destination** — after every source question, before the destination hidden helper. |
| **Defines a masking helper** used by `options.from:` / `scale.from:` / `if:` | **Immediately BEFORE the consuming question.** The helper must be `def`'d before traversal hits the consumer's `options.from:`. |
| **Routes the flow** (`endSurvey("terminate", TermPage)`, `endSurvey("complete", CompletePage)`, a branch flag the next `- if:` reads) | **At the routing point** — the document position where the route is taken. |
| **Function definition only** (a `def` with no side effects at definition time) | Anywhere **before first call**. Function defs register callability rather than executing, so they're the only scripts whose placement isn't tied to traversal order. Co-locate with the first caller anyway when convenient. |

**Implication for hidden helper layout.** Hidden questions that get punched live **next to their punch script**, not clumped at the top of the file. The top-of-file cluster is reserved for hidden questions with **no punch script** — pure lookup / pipe tables like an `errMessages` bank or a long-form label list. Those are data, not state; they don't need a traversal point to be useful.

| Hidden helper kind | Lives... |
|---|---|
| Punched from upstream answers (`hRaceRecode`, `hSegment`, `hHabit`, `hConcept1`) | Right after the punch script that writes it |
| Pure lookup / pipe table, never written (error-message bank, long-form label pipe) | At the top of the file with the other data tables |

#### Examples

```yaml
# ✅ Source → punch script → hidden destination, all co-located.
- qid: Race
    type: multi
    text: Which best describes your race / ethnicity?
    options:
        1: White
        2: Black
        3: Asian
        4: Other

- script: |
    # Punch hRaceRecode (1=White, 2=Black, 3=Asian, 4=Other) from Race.
    # Runs when traversal reaches this position, after Race has been answered.
    if Race.answered:
        if Race.selected.any([2]):
            hRaceRecode.set(2)
        elif Race.selected.any([1]):
            hRaceRecode.set(1)
        elif Race.selected.any([3]):
            hRaceRecode.set(3)
        else:
            hRaceRecode.set(4)

- qid: hRaceRecode
    type: single
    visibility: hide
    title: Race recode (1=White, 2=Black, 3=Asian, 4=Other)
    options:
        1: White
        2: Black
        3: Asian
        4: Other

- qid: NextQuestion
    # ... reads hRaceRecode safely; traversal has already run the punch.
    ...
```

```yaml
# ✅ Masking helper sits directly above its consumer.
- script: |
    # Visible-row helper for HabitFreq: only habits the respondent does at
    # least Occasionally (HabitScreen rating < 4).
    def habit_screen_rows_qualifying():
        result = []
        for code in HabitScreen.all:
            if (HabitScreen.row(code).value or 99) < 4:
                result.append(code)
        return result

- qid: HabitFreq
    type: gridSingle
    options: habitList
    options.from: habit_screen_rows_qualifying()   # nothing qualifying → the question is skipped by itself
    ...
```

```yaml
# ❌ Hidden helper at the top, punch script far below — works under the old
# bulk-pre-pass model but no longer reliable under traversal-based execution.
- qid: hSegment
    type: single
    visibility: hide
    options:
        1: premium
        2: standard

# ... 400 lines later ...
- qid: QSpend
    type: number
    ...

- script: |
    # Punch hSegment — but anything BETWEEN the top definition and this script
    # that reads hSegment.value sees None (unanswered).
    if QSpend.value > 100:
        hSegment.set(1)
    else:
        hSegment.set(2)
```

#### Every script needs a `#` comment

Every `- script: |` block must lead with at least one `#` comment explaining **what** the script does (and **why** if non-obvious). One short line is enough. The comment is for the next person reading the file, not for you.

#### Functions are callable across subsequent scripts

```yaml
- script: |
    # Predicate used by the premium-path branch below.
    def is_premium_buyer():
        return QSpend.value > 100 and QBrandTier.value == 1

- if is_premium_buyer():
    - qid: QPremiumPath
        ...
```

### 6.6 `- note: |`

```yaml
- note: |
    Wave 4 mirror of W3 — verify retailer list before fielding.
```

Free text, ignored by every evaluator — nothing inside it is read as code or piping. This is also the **long-comment form**: there is no block comment in the DSL (`#[[ … #]]` was removed in engine v3.44.0), so a remark longer than a few `#` lines goes in a `- note: |` between blocks.

Always used at the **bottom of every authored `.yml` file** for the delta-log (§19).

---

### 6.7 Ending the survey — `endSurvey` names its end page

A script ends the survey with `endSurvey(outcome, Page)`. **The page is named, never implied by position** — the engine does not show "the question written after the script" (engine v3.45.0).

```yaml
- qid: S3
    type: single
    text: How often do you buy packaged snacks?
    required: True
    options:
        1: Weekly or more often
        2: Monthly
        3: Never

- script: |
    if S3.selected.any([3]):
        endSurvey("terminate", TermPage)

# … the rest of the survey …

- script: |
    endSurvey("complete", CompletePage)

# ---- End pages: shown only to a respondent whose survey ended on them ----
- qid: TermPage
    type: info
    text: Thank you for your interest. Unfortunately you do not qualify for this study.

- qid: QuotaFullPage
    type: info
    text: Thank you for your interest. We already have enough responses from people like you.

- qid: CompletePage
    type: info
    text: Thank you. Your answers have been recorded.
```

**The rules**

| Rule | Detail |
|---|---|
| **Every `endSurvey` has a way out.** | It names an end page, or is followed on the **very next line** by `redirectUrl(...)`, or both. `endSurvey("terminate")` with neither is a publish error (`end-without-page`). |
| **The end page is a `type: info` question.** | Not hidden (`visibility: hide` is refused), not any other type. Written as a bare name, no quotes: `endSurvey("terminate", TermPage)` — not `"TermPage"`. |
| **One page, many endings.** | Ten terminate points name the same `TermPage`. Do not write one page per screen-out — it multiplies the translation work for identical text. Write a second page only when the brief gives a different closing text. |
| **End pages are outside the flow.** | A page named by an `endSurvey` is never shown on the way through the survey, wherever it is written. Keep them together at the bottom, above `- lists:`. Do not put `if:` on them, and do not put them inside a `- loop:` or `- page:`. |
| **Use the brief's wording.** | If the brief gives closing text for terminate / quota full / complete, use it verbatim. If it gives none, write the three neutral pages above and say so in the delta-log. |
| **Outcome first, always.** | `"complete"`, `"terminate"` or `"quotafull"` — nothing else. |
| **It does not stop the script.** | Lines after `endSurvey` in the same script still run. Make it the last statement on its path — followed only by its `redirectUrl(...)`. |

**Sending the respondent back to a panel — `redirectUrl`**

```yaml
- script: |
    if S3.selected.any([3]):
        endSurvey("terminate", TermPage)
        redirectUrl("https://panel.example.com/term?id=" + request.param("pid"))
```

| Written | What the respondent gets |
|---|---|
| `endSurvey("terminate", TermPage)` | The page. The survey is over. |
| `endSurvey("terminate", TermPage)` then `redirectUrl(url)` | The page with a Continue button, which goes to the URL. |
| `endSurvey("terminate")` then `redirectUrl(url)` | Straight to the URL, no page. |

- `redirectUrl(...)` must be the statement **directly after** its `endSurvey` (same indentation). Anything in between, and the `endSurvey` is refused.
- Write the URL in full, with `https://`. It is sent exactly as written — the platform adds nothing to it — so carry the panel's own id through with `request.param("…")` (§10.7).
- Use redirect links only when the brief supplies them (one per outcome is usual). Never invent a panel URL; if the brief mentions redirects without giving the links, name the end page and flag the missing links with `!HUMAN` in the delta-log.

**Never do this** — the position rule of older versions:

```yaml
# ❌ The info page is NOT the closing page. From engine v3.45.0 it is an ordinary
#    question shown to everyone who reaches it, and the bare endSurvey is refused.
- script: |
    if QAge.value < 18:
        endSurvey("terminate")

- qid: QSorry
    type: info
    text: Sorry, you do not qualify.
```

## 7. Lookup (`type: lookup`)

> The lookup data file (`.json` / `.csv`) is uploaded to the lookup server by the human programmer. AI authors the question against the **named list**, and flags the expected list name + columns in the delta-log.

### 7.1 Single-step (`searchInput` default, or `dropdown`)

```yaml
- qid: QState
    type: lookup
    style: dropdown
    text: Which state are you in?
    required: True
    source: http://localhost:3001/lookup/target_states
    source.value: code
    source.display: name
    source.fields: region, timezone
```

### 7.2 Cascading

```yaml
- qid: QVehicle
    type: lookup
    style: cascading
    text: What vehicle do you drive?
    steps:
        - id: make
            label: Select make
            source: http://localhost:3001/lookup/vehicle_makes_models
            source.value: code
            source.display: label
            source.level: 1
        - id: model
            label: Select model
            source: http://localhost:3001/lookup/vehicle_makes_models
            source.value: code
            source.display: label
            source.level: 2
            source.filter: make
            source.fields: body_type, segment
```

Step access: `QVehicle.make.value`, `QVehicle.model.field("body_type")`. `QVehicle.answered` is `True` only when **all** steps complete.

### 7.3 Multi-select lookup

`multi: True` on `style: searchInput` or `style: dropdown`. **Invalid** on `cascading` or with `source.matchOnly: True`.

```yaml
- qid: QBrandsUsed
    type: lookup
    style: searchInput
    multi: True
    min: 1
    max: 5
    text: Which brands do you use?
    source: http://localhost:3001/lookup/brand_master
    source.value: brand_id
    source.display: brand_name
```

Multi accessors: `.values`, `.labels`, `.records`, `.size`. Methods: `.add(value)`, `.remove(value)`, `.reset()`.

### 7.4 `source.matchOnly: True`

Plain text input; validates typed value against source but shows no picker. **Always use `.matched` for screenouts** — `.answered` is `True` even on a non-match.

```yaml
- qid: SZip
    type: lookup
    source: http://localhost:3001/lookup/target_zips
    source.value: zipcode
    source.display: zipcode
    source.matchOnly: True

- if not SZip.matched:
    - script: |
        endSurvey("terminate", TermPage)
```

### 7.5 Property reference

| Property | Notes |
|---|---|
| `source` | URI of the list asset. `http://...` / `project://name`. |
| `source.value` | Column stored as the answer value (primary key). |
| `source.display` | Column shown as the human label. |
| `source.fields` | Comma-separated extra columns (read via `.field("col")`). |
| `source.searchFields` | Columns matched against typed input (defaults to `source.display`). |
| `source.groupBy` | Column whose distinct values become section headers. |
| `source.minChars` | Minimum chars before search runs. |
| `source.matchOnly` | `True` — text input that validates against source. |
| `source.filter` | (cascading step) parent step id that filters this step. |
| `source.level` | (cascading step) hierarchical level. |
| `multi` | `True` — multi-select picker (searchInput / dropdown only). |
| `min` / `max` | Multi-select count bounds. |
| `steps` | Cascading-only — ordered list of step definitions. |
| `default` | Default answer (programmer prefill). |

**Lookup answer values are not numeric codes — they are whatever string the `source.value` column contains.**

`global://name` is a deprecated alias for `project://name`. Don't author it.

---

## 8. mixGrid

Transposed container. Parent declares the **shared row domain**; nested column qids each keep their own real type and runtime API.

```yaml
- qid: QBrandPerception
    type: mixGrid
    text: Tell us about each brand
    options: retailBrands
    options.from: QBrandsAware.selected        # optional — filters the ROWS
    columns:
        - qid: QBrandBest
            type: single
            title: Best overall                # one row picked down the column
        - qid: QBrandFamiliarity
            type: gridSingle
            title: Familiarity                 # one scale point per row
            scale: familiarityScale            # a named list, or an inline `scale:` block
            scale.from: hLevels.selected       # optional — filters this column's SCALE
        - qid: QBrandRecommend
            type: numberList
            title: Likelihood to recommend (0–10)
            min: 0
            max: 10
```

Rules:
- Shared rows come **only** from the parent `options:` / `options.from:` / `group:`. Do not re-author `options`/`group` on nested column qids.
- Children allowed: `single`, `multi`, `rank`, `openList`, `numberList`, `gridSingle`. Plain `open`, plain `number`, and `gridMulti` are **rejected** — use `openList` / `numberList` for one text / number per row, and `gridSingle` (with its own `scale:`) for a rating per row.
- `columns:` must contain at least one child.
- **Filters (engine v3.44.0).** `options.from:` on the parent filters the rows of every column. `scale.from:` on a `gridSingle` column filters that column's scale. If the row filter leaves no rows, the whole grid is skipped; if a column's scale filter leaves nothing, that column is dropped and the others stay. Skipped parts export blank.
- **Required columns are enforced.** A respondent cannot continue past a mixGrid with a required column left unanswered.

---

## 9. Piping — `{{ ... }}`

**Piping syntax is double-brace `{{ expr }}`.** Single-brace is not piping.

Pipe-aware fields: `text:`, `title:`, `instruction:`, option `label:`, row `label:`, scale `label:`, and the message strings inside `fail(...)` and `print(...)`.

```yaml
- qid: QFollow
    type: open
    text: Tell us more about {{ QBrand.selectedLabel }}.
```

When the respondent picks Samsung at `QBrand`, they see: *"Tell us more about Samsung."*

### Common pipe expressions

| Expression | Renders |
|---|---|
| `{{ QBrand.selectedLabel }}` | Label of a single-answer question |
| `{{ QBrand.value }}` | Raw value (code as string for `single`) |
| `{{ QBrand.selected.size }}` | Count of selections |
| `{{ QAge.value + 1 }}` | Arithmetic |
| `{{ brandLoop.selectedLabel }}` | Current loop iteration's label |
| `{{ QSat.row(2).selectedLabel }}` | A row's selected label inside a grid |
| `{{ QErrMsg.row(1).label }}` | An option's label (e.g. error message bank) |
| `{{ round(QSpend.value, 2) }}` | Rounded to 2 decimals (`%` / `.format()` formatting is not supported — §10.2) |
| `{{ round(QPercent.value * 100) }}` | Built-in arithmetic |
| `{{ "there" if not QName.answered else QName.value }}` | Inline conditional |

### Piping inside option/scale labels

```yaml
- qid: QFav
    type: single
    options:
        1: I prefer {{ QBrand.selectedLabel }}
        2: I prefer something else
        3: I have no preference
```

```yaml
- qid: QBrandFit
    type: gridSingle
    text: How well does each attribute describe {{ QBrand.selectedLabel }}?
    options: brandAttributes
    scale:
        1: Doesn't describe {{ QBrand.selectedLabel }} at all
        2: Describes {{ QBrand.selectedLabel }} a little
        3: Describes {{ QBrand.selectedLabel }} well
        4: Describes {{ QBrand.selectedLabel }} perfectly
```

### Piping inside `fail()` / `print()`

```yaml
- qid: QAlloc
    type: numberList
    text: Allocate 100 points across these categories.
    options: spendCategories
    validation: |
        total = 0
        for c in QAlloc.all:
            total = total + (QAlloc.row(c).value or 0)
        if total != 100:
            fail("Allocations must sum to 100. You have {{ total }}.")
```

`{{ total }}` references the local variable computed inside the `validation:` block. Anything in scope when `fail()` runs — the validation's own variables, hidden question values, `Q.*` accessors — is available inside `{{ }}`.

**With the `QErrMsg` bank (§5.6):** keep the static sentence in the bank and add the piped part in the `fail()` call — the variable only exists inside the validation, so it cannot be piped from the option label itself:

```python
fail(QErrMsg.row(6).label + " You have {{ total }}.")    # ✓ static text from the bank, variable piped here
```

A `{{ total }}` written inside the `QErrMsg` option label is an `unknown-name` publish error. Pipes are checked like any other code (§10.0): an unknown name inside `{{ }}` blocks publish, in display text and in `fail()` messages alike.

### Auto-escaping in HTML contexts

Piped values are HTML-escaped automatically. A respondent who typed `<script>alert(1)</script>` into `QName` produces literal text in the rendered output, not an executed tag. You can pipe any answer (including free `open` text) into HTML contexts without writing your own escaping.

---

## 10. The Python subset

Used in `validation: |`, `if:`, `script: |`, `options.from:`, `scale.from:`, `order:`, and inside `{{ }}` pipes.

**The language is Python-based and strict (engine v3.44.0+).** Every piece of code is read by a real grammar and checked before publish. Anything the language does not explicitly support is an **error that blocks publish** — the platform never guesses what you meant and never silently ignores a line. Write only what this section lists. It is *based on* Python, not identical to it: `range` is inclusive, `round` rounds halves away from zero, and several Python features are deliberately left out (§10.2).

**Comments.** `#` starts a comment — a whole line, or the end of a code line. Nothing inside a comment is read: not code, not `{{ }}`. This holds in scripts, validation, flow headers (`- if Q.answered:  # only if answered`) and question properties.

**There is no block comment.** `#[[ … #]]` was removed in v3.44.0 and is now an error (`block-comment-removed`). For several lines, put `#` on each line; for a longer remark between blocks, use `- note: |` (§6.6).

### 10.0 The strict rules — read these first

These are the rules the checker enforces on every line. Most publish errors on AI-written surveys come from this table.

| Rule | ✗ Refused | ✓ Write |
|---|---|---|
| **A condition is a yes/no test.** Applies to `if` / `elif` / `while`, each side of `and` / `or` / `not`, a question's `if:`, and `- if …:` flow headers. A number, text or selection is not a test. | `if QAge.value:` · `if QBrands.selected:` · `if not request.param("src"):` · `if: 1` | `if QAge.answered:` · `if QBrands.selected.size > 0:` · `if request.param("src") == "":` · `if: 1 == 1` |
| **`.answered`, `.notAnswered`, `.matched` are True / False.** Never compare them with a number. | `if Q1.answered == 1:` · `if: Q1.answered == 0` | `if Q1.answered:` · `if: not Q1.answered` |
| **Like with like.** Numbers compare and combine with numbers, text with text. | `Q1.value == "2"` · `"Age: " + QAge.value` · `QAge.value.strip()` | `Q1.value == 2` · `"Age: " + str(QAge.value)` · `.strip()` only on text |
| **Codes are numbers.** Option, row and scale codes are never quoted. | `Q1.set("2")` · `hSegment.set("premium")` · `hSegment.value == "premium"` | `Q1.set(2)` · `hSegment.set(1)` · `hSegment.value == 1` |
| **Codes, rows and scale points must exist** on the question they are used with. | `Q1.set(9)` when `Q1` has options 1–5 · `QGrid.row(12)` · `Q1.selected.any([1, 9])` | Only codes the question declares |
| **Text and lists are never `None`.** Unanswered text is `""`; nothing selected is an empty list. | `if QOpen.value is None:` · `if QBrands.selected is None:` | `if not QOpen.answered:` · `QOpen.value == ""` · `QBrands.selected.size == 0` |
| **A write gives nothing back.** | `x = Q1.set(2)` · `x = items.append(3)` | The call on a line of its own |
| **A line must do something.** | A bare `QAge.value + 1` on its own line | Store it, test it, or pass it on |
| **One comparison at a time.** | `1 < x < 10` | `1 < x and x < 10` |
| **A condition stays on one line.** No `\` continuation, no wrapping an `if` test across lines. | `if (a and b) \` ⏎ `or (c and d):` | Move the test into a `def` helper and call it (§11) |
| **Masks and orders give codes.** `options.from:` / `scale.from:` / `order:` / `scale.order:` must work out to a list of the question's own codes, and may not change anything. | `options.from: QBrand.selected.size` · `options.from: QBrand.set(1)` | `options.from: QBrand.selected` · `options.from: helper()` |
| **`fail()`, `endSurvey()` take what they document.** | `endSurvey("screenout")` · `endSurvey("terminate")` on its own | `endSurvey("terminate", TermPage)` — the outcome is only `"complete"`, `"terminate"` or `"quotafull"`, and it names an end page or is followed by `redirectUrl(...)` (§6.7) |

**Unanswered answers — `None`.** A coded or numeric answer that has not been given is `None`: `single.value`, `number.value`, a grid or list row's `.value`. Testing it with `==`, `!=` or `in` is fine (the test is simply False). Doing **arithmetic** or **`<` `>` `<=` `>=`** with it is an error *when that line runs* — in a `validation:` the respondent gets a generic "problem checking this answer" message instead of yours; in a script the line fails and is logged. So before arithmetic or ordering on anything that might be unanswered, either gate on `.answered` or coalesce with `(x or 0)`:

```python
if QAge.answered and QAge.value < 18:        # gate
    endSurvey("terminate", TermPage)
total = total + (QAlloc.row(c).value or 0)   # coalesce — a blank row counts as 0
```

**`sum()`, `avg()`, `min()`, `max()` over a list pass over blank rows** (engine v3.44.1). `sum(Q.values)` adds the rows that were answered; `avg(Q.values)` is the mean of the answered rows (a blank is *not* counted as 0). With every row blank, `sum` is `0` and the other three give `None`. Written out with separate values (`max(a, b)`), a `None` is still an error.

**A `validation:` also runs when the answer is blank.** On an optional question, start the test with `.answered` (`if QEmail.answered and not re.fullmatch(...)`) so a skipped question is neither failed nor read as `None`.

The editor separately **warns** (it does not block) when a script reads a question that is asked *later* in the survey — the answer cannot exist yet. Writing forward with `.set(...)` is fine.

### 10.1 Control flow — supported

`if` / `elif` / `else`, `for`, `while`, `break`, `continue`, `pass`, `def` / `return`, `try` / `except` / `finally`, and the inline conditional `a if cond else b`.

```python
# if / elif / else
if QAge.value < 18:
    hAgeBand.set(1)
elif QAge.value < 35:
    hAgeBand.set(2)
else:
    hAgeBand.set(3)

# Inline conditional — allowed anywhere a value is: scripts, validation, .set(...), pipes
hQ7.set(1 if QBoxed.value == 1 else 2)

# for, with break / continue
rows = []
for code in QBrand.all:
    if code == 97:
        continue                # skip the "None" anchor
    rows.append(code)

# for with two names
for index, code in enumerate(QBrand.selected):
    print(index, code)

# def — plain parameter names only (no default values, no *args / **kwargs)
def is_premium():
    return QSpend.value > 100

# try / except / finally
try:
    n = int(QCode.value)
except Exception:
    n = 0
```

`def`'d functions defined in one `- script:` are callable from every subsequent `- script:`, from `- if <expr>:` predicates, and from `if:` / `options.from:` / `validation:`. `return` is only valid inside a `def`.

Assign one value per line (`a = 1` then `b = 2`; `a, b = 1, 2` is refused). `+=` / `-=` are supported.

### 10.2 Not part of the language

| Construct | Use instead |
|---|---|
| List / dict / set comprehensions, generator expressions | Explicit `for` loop with `result.append(...)` |
| `lambda` | A `def` |
| Decorators, `class`, `with`, `async` / `await` / `yield`, walrus `:=` | Plain functions and assignments |
| `import` (any) | `math`, `random`, `re`, `datetime` are already there |
| `//` floor division | `int(a / b)` |
| f-strings (`f"..."`), `"%s" % x`, `"…".format(x)` | `"..." + str(x)` — or `{{ }}` in display text |
| Default parameter values, `*args`, `**kwargs` | Plain parameters |
| `a, b = 1, 2` (several values in one assignment) | One assignment per line |
| Chained comparison `1 < x < 10` | `1 < x and x < 10` |
| `switch` / `case`, `catch`, `else if`, backtick strings | `if` / `elif` / `else`, `except`, `elif`, `"…"` |
| Block comments `#[[ … #]]` | `#` on each line, or `- note: \|` |
| `\` line continuation; an `if` test wrapped across lines | One line, or a `def` helper |
| Extra arguments on text methods (`s.split(",", 1)`) | `re.split(...)` |
| A trailing comma on a statement (`x = 1,`); numbers with a leading zero (`03`) | `x = 1`; `3` |
| `return` outside a `def` | Wrap the logic in a `def`, or use `if` / `else` |
| File I/O / network | Sandboxed runtime |

### 10.3 Operators — supported

Comparison `==` `!=` `<` `<=` `>` `>=`, boolean `and` `or` `not`, membership `in` `not in`, identity `is None` / `is not None`, arithmetic `+` `-` `*` `/` `%` `**`, unary minus, indexing `x[0]` `x[-1]` `x[1:3]`, parentheses.

- `/` is true division: `7 / 2` is `3.5`. For a whole number use `int(a / b)`.
- `+` adds numbers, joins text with text, and joins a list with a list. It never mixes a number with text — wrap the number in `str(...)`.
- `%` is the numeric remainder only (`7 % 3`), not text formatting.
- `a or b` as a **value** is allowed: `(QAge.value or 0)` gives `0` when unanswered.
- Slices follow Python — the end position is **not** included: `"abcdef"[0:4]` is `"abcd"`. (Only `range` includes its end.)

### 10.4 Built-ins — pre-imported, no `import` needed

```python
# Aggregate
len(x)              # length of text / list / selection
min(x)              # minimum         (also min(a, b))
max(x)              # maximum         (also max(a, b))
sum(x)              # sum of a list   (also sum(a, b, …) over several lists)
avg(x)              # mean (platform addition)
sorted(x)           # new sorted list (key=<def name>, reverse=True supported)
range(start, end)   # INCLUSIVE on both ends — range(1, 3) is 1, 2, 3 (different from Python)
enumerate(x)        # (index, value) pairs
zip(a, b)           # parallel iteration
any(x)              # True if any item is true
all(x)              # True if all items are true

# Constructors
set([1, 2, 3])
list(x)
dict()
tuple(x)

# Type conversion
str(x)              # to text
int(x)              # to whole number — strict, fails on bad input
float(x)            # to number — strict, fails on bad input
bool(x)
isNumeric(x)        # platform: True if the text x reads as a number
toNumeric(x)        # platform: text to number
toInt(x)            # platform: text to whole number (strict)
toString(x)         # platform: same as str
parseInt(x)         # platform: text to whole number (strict)
parseFloat(x)       # platform: text to number (strict)

# Math
abs(x)
round(x)            # halves round AWAY from zero: round(2.5) is 3, round(-2.5) is -3
round(x, n)         # to n decimals: round(2.675, 2) is 2.68
```

`sum` / `avg` / `min` / `max` over a list skip its blank rows (`None`); text in the list is an error. See "Unanswered answers" in §10.0.

**There is no fixed-decimals formatting.** `round(x, 2)` rounds the number; `str(round(3.10, 2))` is `"3.1"`, not `"3.10"`. If the questionnaire needs a fixed number of decimals shown, add a `!HUMAN` line in the delta-log.

### 10.5 Safe modules — pre-imported

```python
math.floor(x)
math.ceil(x)
math.sqrt(x)
math.exp(x)
math.log(x)
math.pow(x, y)
math.pi
math.e

random.choice([1, 2, 3])
random.shuffle(my_list)         # in place — on a line of its own
random.sample(my_list, 2)       # 2 different items
random.randint(0, 10)           # whole number in [0, 10] inclusive

re.match(pattern, text)
re.search(pattern, text)
re.fullmatch(pattern, text)     # anchored both ends — use this for validation regex
re.sub(pattern, replacement, text)
re.split(pattern, text)
re.findall(pattern, text)
re.escape(s)

datetime.today()                # today's date — prints as "2026-11-19"
datetime.now()                  # date and time — prints as "2026-11-19T10:51:58"
datetime.today().year           # also .month, .day
datetime.now().hour             # also .minute, .second (and .year / .month / .day)
datetime.today().isoformat()    # the date as text
datetime.date(2026, 1, 5)       # a date from its parts
```

`random` produces respondent-specific results that won't reproduce on replay — gate treatment assignments behind a hidden flag so the same respondent doesn't re-randomise on navigation.

`re.fullmatch` (not `re.match`) is the right choice for validation regex — it anchors both ends. Test a match with `is not None`; read the matched text with `.group(n)` (also `.groups()`, `.start()`, `.end()`), or use `re.findall(...)`.

**Dates are deliberately small** (engine v3.44.1). A date has `.year`, `.month`, `.day` and `.isoformat()`; a date-and-time adds `.hour`, `.minute`, `.second`. The parts are values (no brackets); `.isoformat()` is a function. Python's longer spellings `datetime.date.today()` and `datetime.datetime.now()` also work. There is **no `datetime.timedelta`** and no date arithmetic — work with the parts (`datetime.today().year - QBirthYear.value`). Nothing else exists on a date (`.weekday()`, `.strftime()` … are refused).

### 10.6 Text methods — supported

`.strip()` / `.lstrip()` / `.rstrip()`, `.lower()`, `.upper()`, `.startswith(s)`, `.endswith(s)`, `.split()` (on spaces) or `.split(sep)`, `sep.join(list)`, `.replace(old, new)` (every occurrence), `.find(text)` (position, `-1` when absent), `s in s2`, `len(s)`, index and slice (`s[0]`, `s[-1]`, `s[1:3]`).

Each takes exactly the arguments shown — an extra argument is an error, not ignored. No other text methods exist (no `.format`, `.title`, `.count`, …).

Text is written in `"double"` or `'single'` quotes. Raw text `r"\d{5}"` is supported — use it for regex patterns so backslashes are kept as written.

### 10.7 Runtime helpers

| Helper | Usage |
|---|---|
| `fail(message)` | Inside `validation:` — reject the answer with a message. Pipe-aware via `{{ }}`: the message can read the validation's own variables (`fail("You have {{ total }}.")`) and any accessor. An unknown name inside the `{{ }}` is a publish error. |
| `print(message)` | Inside `- script:` — diagnostic output. |
| `endSurvey(outcome, Page)` | Inside `- script:` — end the survey on the end page it names (§6.7). The outcome is exactly `"complete"`, `"terminate"` or `"quotafull"`; `Page` is the bare name of a `type: info` question. The page may be left out only when `redirectUrl(...)` is the next line. **It does not stop the script** — lines after it in the same script still run — so make it the last statement on its path (inside `if` / `else`, or at the end). |
| `redirectUrl(url)` | Inside `- script:`, on the line directly after `endSurvey(...)` — send the respondent to `url` (after the end page, if one was named). The URL is text, written in full with `https://`, and is sent exactly as written (§6.7). |
| `quota("groupId", cellCode)` | Read a quota cell's current state. Rare in author code; quota cells are configured by the human in the Quota Builder. |
| `q(baseName)` / `q(baseName, code)` | Dynamic qid lookup — the question named `baseName`, or `baseName + code` (see §10.8). |
| `request.url` | Current URL, as text. |
| `request.param("key")` | Query-string parameter, as text. **Gives `""` for a missing key, never `None`.** Test with `== ""` / `!= ""`. |

### 10.8 `q()` — dynamic qid lookup

`q(baseName)` returns the runtime proxy for the question with that qid. `q(baseName, code)` **concatenates `code` onto `baseName` (no separator inserted)** and looks up the combined name. The checker cannot see a name you build at run time, so a wrong name is **not** a publish error: it gives an empty, unanswered placeholder and the write goes nowhere. Double-check every computed name against the real qids.

**Use it when the qid is a string you compute at runtime.** For literal qids and for the standard loop cross-iteration access, the bare-name and bracket forms are cleaner.

| Form | Resolves to | Use when |
|---|---|---|
| `QAge.value` | `QAge` (literal) | The qid is known at authoring time |
| `QRating_[c].value` | `QRating_<c>` (loop iteration access) | Reading a specific loop iteration's answer — the bracket-proxy form is the standard idiom (§6.3 cross-iteration access) |
| `q("QAge").value` | `QAge` | Equivalent to bare `QAge` — useful when the qid is held in a variable |
| `q("QRating_", c).value` | `QRating_<c>` | Same as bracket-proxy, but in code paths where the suffix is computed |
| `q("Q1Concept", iter).set(...)` | `Q1Concept<iter>` | **Derotation punches.** Slot names like `Q1Concept1`, `Q1Concept2` use no separator, matching `q()`'s concatenation behaviour. |

**The two-arg form does NOT insert a separator.** This is the most common gotcha:

```python
q("QRating_", c)            # ✓ resolves to QRating_1, QRating_2, ...
q("QRating", c)             # ✗ resolves to QRating1, QRating2, ... — wrong for the loop convention
q("QRating_" + str(c))      # ✓ same effect, single-arg form
```

The underscore is **part of the loop-iteration naming convention**, not something `q()` injects. Loop questions export as `QRating_1`, `QRating_2`, so to reach them you supply the underscore yourself in `baseName`.

**Naming conventions across patterns:**

| Pattern | Slot/qid naming | Reach via |
|---|---|---|
| Loop cross-iteration access | `QRating_<iter>` (underscore from loop suffix convention) | `QRating_[c]` (bracket-proxy) or `q("QRating_", c)` |
| Derotation slots | `Q1Concept<concept>` (no separator — CamelCase) | `q("Q1Concept", iter)` |
| Anything bespoke / computed | Whatever string you build | `q(computed_name)` |

**When to reach for `q()`:**
- Derotation slot punches where slot names follow a `<question><concept>` pattern (§16.13).
- Building qids from a configuration map or a list lookup at runtime.
- Wrapping the same logic over many similarly-named hidden helpers.

**When NOT to use `q()`:**
- Reading a literal hidden helper — use the bare qid: `hRaceRecode.value`, not `q("hRaceRecode").value`.
- Reading a loop iteration — use the bracket-proxy: `QRating_[c].value`, not `q("QRating_", c).value`.

### 10.9 Defensive idioms

```python
# Unanswered numeric → coalesce to 0 before arithmetic
total = (QAge.value or 0) + (QPartnerAge.value or 0)

# Gate on .answered before comparing with < or >
if QSpend.answered and QSpend.value > 100:
    hSpendBand.set(2)
else:
    hSpendBand.set(1)

# Missing request parameter — it is "" (never None), and text is not a yes/no test
if request.param("source") == "":
    hSourceMissing.set(1)

# Number typed into an `open` question — check before converting
# (QAgeText is type: open; on a type: number question .value is already a number)
if QAgeText.value.strip() != "" and not isNumeric(QAgeText.value):
    fail("Enter a valid number.")
elif isNumeric(QAgeText.value) and toNumeric(QAgeText.value) < 18:
    fail("Must be 18 or older.")
```

---

## 11. Runtime accessors — by question type

### Question-level

| Type | Accessors | Methods |
|---|---|---|
| `info` | (none) | (none) |
| `single` | `value`, `selected`, `selectedLabel`, `all`, `allLabels`, `answered`, `notAnswered` | `set`, `reset`, `specify` |
| `multi` | `selected`, `selectedLabels`, `all`, `allLabels`, `answered`, `notAnswered` | `add`, `set`, `reset`, `specify`, `row(code)` |
| `rank` | `selected`, `selectedLabels`, `all`, `allLabels`, `values`, `answered`, `notAnswered` | `at`, `set`, `reset` |
| `open` | `value`, `answered`, `notAnswered` | `set`, `reset` |
| `openList` | `all`, `allLabels`, `values`, `answered`, `notAnswered` | `at`, `set`, `reset`, `row(code)` |
| `number` | `value`, `answered`, `notAnswered` | `set`, `reset` |
| `numberList` | `all`, `allLabels`, `values`, `answered`, `notAnswered` | `at`, `set`, `reset`, `row(code)` |
| `gridSingle` | `selected`, `all`, `allLabels`, `values`, `answered`, `notAnswered` | `at`, `set`, `reset`, `row(code)` |
| `gridMulti` | `all`, `allLabels`, `answered`, `notAnswered` | `at`, `set`, `reset`, `row(code)` |
| `gridNumber` | `all`, `allLabels`, `answered`, `notAnswered` | `at`, `set`, `reset`, `row(code)`, `col(code)` |
| `mixGrid` | (none — children carry their own) | (none) |
| `lookup` (single) | `value`, `label`, `record`, `matched`, `answered`, `notAnswered` | `field(col)`, `set`, `reset` |
| `lookup` (multi) | `values`, `labels`, `records`, `size`, `answered`, `notAnswered` | `add(value)`, `remove(value)`, `reset` |
| `loop` var | `value`, `selectedLabel`, `all`, `allLabels`, `at`, `size` | (none) |
| `cbc` | (none after the exercise — read a task through `task(T)`. Inside an in-task follow-up, `selected`, `ratings(N)`, `rank(N)`, `level(A)` on the question read the task being answered — §2.1) | `task(T)` — returns the task slice for task T (1-based) |
| CBC task slice (`QCbc.task(T)`) | `selected` — the concept chosen, as a selection (choice mode; 1 = first concept, 0 = none; test with `.any([...])`, `== 0` / `!= 0`) | `ratings(N)` — scale code concept N got (rating mode). `rank(N)` — rank position concept N got, 1 = top (rank mode). `level(A)` — level of attribute A in the chosen concept (choice mode): `.code`, `.label`, `.answered`, `.any([...])`; pipes as its label. N and A are 1-based. |
| `maxdiff` | (none after the exercise — read a set through `task(T)`. Inside an in-task follow-up, `best` / `worst` on the question read the set being answered — §2.1) | `task(T)` — returns the task slice for set T (1-based) |
| MaxDiff task slice (`QMaxDiff.task(T)`) | `best`, `worst` — the item picked: `.code`, `.label`, `.answered`, `.any([...])`; pipes as the item's label | (none) |

### Row-level (`.row(code)` / `.at(index)`)

| Row type | Accessors | Methods |
|---|---|---|
| `multi` (entry proxy) | `label` only | (none) |
| `openList` row | `value`, `label`, `answered`, `notAnswered` | `set`, `reset` |
| `numberList` row | `value`, `label`, `answered`, `notAnswered` | `set`, `reset` |
| `gridSingle` row | `value`, `label`, `selected`, `selectedLabel`, `all`, `allLabels`, `answered`, `notAnswered` | `set`, `reset`, `col(code)` |
| `gridMulti` row | `label`, `selected`, `selectedLabels`, `all`, `allLabels`, `answered`, `notAnswered` | `add`, `set`, `reset`, `col(code)` |
| `gridNumber` row | `label`, `values`, `answered`, `notAnswered` | `set`, `reset`, `col(code)` |

### Cascading lookup step (`Q.stepId`)

`value`, `label`, `record`, `answered`, `notAnswered`, plus `field(col)`.

### Subtleties — easy to get wrong

- **`multi` has no `selectedLabel`.** Use `Q.selectedLabels.at(0)`.
- **`gridMulti` has no question-level `selected`.** The question-level accessors are `all`, `allLabels`, `answered`, `notAnswered` only. To check "did the respondent pick any of codes X / Y at any row", iterate via `Q.row(r).selected.any([X, Y])` — extract a helper function for any expression spanning multiple rows. Mirroring gotcha: `Q.selected.size` doesn't exist on `gridMulti` either — use `Q.row(r).selected.size` per row, or sum / union across rows.
- **`multi.row(code)` returns an entry proxy with `.label` only** — no `.selected`/`.code`/`.value`. Use `Q.selected.any([code])` to test selection.
- **`multi.selected` is in authored domain order, not click order.** `rank` preserves user rank order. `single` and `gridSingle` return the single active code.
- **`.all` always returns the full authored domain** regardless of any active mask.
- **Loop `.at` is a positional 1-based index**, not a collection method.
- **CBC per-task accessors are numeric, 1-based columns everywhere.** Write `QCbc.task(1).ratings(1)` — the rating for the concept in column 1 (= "A"). The bracket/letter form `QCbc.task(1).ratings["A"]` is a **silent no-op in live surveys** (it compiled to `unparsed` on the published path and only ever worked in editor preview). Never author it.
- **CBC has no `.chosen`.** The concept picked in a task is `QCbc.task(T).selected` (1 = first concept, 0 = the none option); what that concept *was* is `QCbc.task(T).level(A)`, because the design shuffles concepts across columns. There is also no `.value`, `.selectedLabel`, `.answered` or `.none` on `QCbc` or `QCbc.task(T)` (§2.1).
- **`.selected` excludes `isolate: True` codes across every type.** The old pattern of writing `Q.selected.any([99])` to detect a "Prefer not to answer" opt-out now returns False even when the respondent selected it. For most survey logic **use `Q.answered` instead** — it returns True whether the respondent gave a real answer or picked the opt-out, which is what you usually want for skip logic and required gates. A dedicated opt-out accessor was specced (`Q.optedOut` / `Q.isolated`) but is **not required** for typical authoring — reach for it only if a downstream branch genuinely needs to distinguish "answered normally" from "opted out", and check the current runtime API for the shipped name.
- **`.answered` returns True when only the opt-out is selected.** So a `required: True` question with an `isolate: True` opt-out is satisfied by checking the opt-out — no separate handling needed.
- **`.all` excludes `isolate: True` options from the returned domain.** So `options.from: QAreas.all.minus([3])` on a downstream question won't include the opt-out code even if the source question has one. This is intentional — masks don't propagate opt-outs.
- **Lookup `.matched` vs `.answered`:** `matchOnly` lookups have `.answered = True` after any text — always check `.matched` for screenouts.
- **Cross-iteration access uses `Qx_` (trailing underscore) accessor, not bare brackets.** Static: `QRating_1.value`. Dynamic: `QRating_[c].value`. Nested: `QRating_[b][a].value`. The dynamic-name form `q("baseName", code)` resolves a qid by string. Without these, references inside a loop body resolve to the current iteration; outside the loop, you must qualify with one of these forms.

### Absence semantics

| Accessor kind | When unanswered | Test it with |
|---|---|---|
| coded scalar (`single.value`, `gridSingle.row(n).value`) | `None` | `.answered`, `== code`, `(x or 0)` |
| numeric (`number.value`, `numberList.row(n).value`) | `None` | `.answered`, `(x or 0)` |
| text (`open.value`, `openList.row(n).value`) | `""` — never `None` | `.answered`, `== ""` |
| collection (`multi.selected`, `rank.values`) | empty collection — never `None` | `.size == 0`, `.answered` |
| list of row values (`numberList.values`, `gridSingle.values`) | a list with `None` for each blank row | `sum()` / `avg()` / `min()` / `max()` skip the blanks |
| missing rank slot | `None` | |
| `request.param(...)` missing key | `""` (never `None`) | `== ""` |

`None` is safe in `==` / `!=` / `in` (the test is False) but **not** in arithmetic or `<` `>` — that is a runtime error (§10.0 "Unanswered answers"). Writing `is None` on a text answer or a collection is a publish error, because it can never be true.

**A masked question with nothing to show is skipped, and its data is blank.** When `options.from:` / `scale.from:` works out to an empty list (or fails), the engine skips the question by itself — no `if:` guard is needed — and every column of that question exports blank (not 0). In data: ticked = 1, shown but not ticked = 0, never shown = blank.

### Collection / Set ops

Returned by `.selected`, `.all`, `.values`, `.allLabels`, `.selectedLabels`, `.records`.

Properties: `.size`, `.labels`.
Methods: `.at(n)`, `.any([codes])`, `.every([codes])`, `.intersect([codes])`, `.union([codes])`, `.minus([codes])`. `.add` / `.remove` exist on set objects, not directly on `.selected`.

Membership: `code in Q.selected`, `code not in Q.all`. Build a fresh set with `set([1, 2, 3])`.

**Deprecated — never use:** `.contains(...)`, `.has_any(...)`, `.has_all(...)`, `.iter`, `.iteration`, `.labels` on a question (use `selectedLabel`/`selectedLabels`/`allLabels`).

### Methods that give a result vs methods that only change something

Some methods hand back a new value you can store or chain; others only make a change and give **nothing** back. Storing the result of the second kind (`x = Q1.set(2)`) is a publish error (`no-value`).

#### Give a result — safe to store or chain

| Receiver | Methods |
|---|---|
| A survey collection (`Q.all`, `Q.selected`, `Q.values`, `Q.allLabels`, `Q.selectedLabels`, `Q.records`) | `.add(codes)`, `.remove(codes)`, `.intersect(codes)`, `.union(codes)`, `.minus(codes)` — each returns a **new** collection; the answer itself is not changed |
| Text | every text method in §10.6 |
| `dict` | `.get(key, default)`, `.keys()`, `.values()`, `.items()`, `.has(key)` |

```python
shown = QBrand.all.minus([97])                 # ✓ new collection
extra = QBrand.selected.add([97, 98])          # ✓ several codes at once — codes must exist on QBrand
```

#### Only change something — call on a line of their own

| Receiver | Methods |
|---|---|
| Any question proxy — bare qid (`Q1`), `q(...)`, a row (`Q.row(c)`) | `.set(payload)`, `.reset()`, `multi.add(code)` |
| A plain `list` you built (`rows = []`) | `.append(x)`, `.extend(list)`, `.remove(x)`, `.sort()`, `.clear()` |
| A plain `dict` you built | `d[key] = value`, `.set(key, value)`, `.update(other)`, `.clear()` |
| `quota(group, code)` | **Read-only from scripts.** `.isOpen`, `.count`, `.target`, `.remaining` — no write method. The engine auto-fills cells on `endSurvey("complete", CompletePage)`. See §15. |

```python
Q1.set(2)                          # ✓ on its own line
rows.append(97)                    # ✓ on its own line
rows.extend([97, 98])              # ✓ add several codes to a list you built

x = Q1.set(2)                      # ✗ publish error `no-value` — nothing to store
kept = rows.remove(99)             # ✗ same
Q1.set(2).reset()                  # ✗ nothing to chain on
```

**Adding several codes to a list you built: use `.extend([...])`.** Do not write `set(rows).add([97, 98])` — on a constructed set, `.add` takes **one** value, so the list goes in as a single nested item and the mask silently loses both codes. `set(...)` is for removing duplicates and for `in` tests; `.add(x)` on it adds one value.

#### Quick decision rule

A **question** or a **list / dict you built** → the method changes it and gives nothing back; call it on its own line.
A **survey collection** (`Q.selected`, `Q.all`, …) or **text** → the method returns a new value; store it or chain it.

### Authoring style — prefer accessors over raw iteration

The runtime gives you collection accessors and built-ins for the shapes that come up over and over. Reach for them first; write a `for` loop only when the accessor surface genuinely doesn't cover the case. The accessor form is shorter, faster to read, faster to execute, and less likely to drift when the underlying domain changes.

```python
# ❌ Verbose — manual iterate-and-accumulate.
t = 0
for c in Device.all:
    t = t + (Device.row(c).value or 0)
if t != 100:
    fail(QErrMsg.row(6).label)

# ✅ Idiomatic — sum() over the .values accessor. A blank row is passed over.
if sum(Device.values) != 100:
    fail(QErrMsg.row(6).label + " You have {{ sum(Device.values) }}.")
```

A few patterns worth knowing:

| Goal | Accessor form |
|---|---|
| Sum a `numberList`'s row values | `sum(Q.values)` — blank rows are passed over |
| Average a `numberList`'s row values | `avg(Q.values)` — mean of the answered rows; `None` when none is answered |
| Count selections on a `multi` | `Q.selected.size` |
| Membership test (single or multi) | `Q.selected.any([codes])` — **always go through `.selected`**, even on `single` questions. `.any(code)` is a shorthand for one code. `code in Q.selected` reads naturally for one code too. `Q.value == N` still works on `single` for a single code; for two-or-more codes, prefer `Q.selected.any([N1, N2])` over a chain of `or`s — easier to extend, easier to read. **There is no `Q.any(...)` form** — `.selected` is required, mirrors are not valid. |
| All of these codes selected? | `Q.selected.every([codes])` |
| Set difference | `Q.selected.minus([codes])` |
| Add several codes at once | `Q.selected.add([codes])` on a survey collection; `rows.extend([codes])` on a list you built |
| Get a row's value defensively | `(Q.row(code).value or 0)` (None → 0) |
| Check answered before reading | `Q.answered` (it is True / False — never `== 1`) |

**Multi-add idiom.** When you'd otherwise call `.append(x)` two or more times in a row to extend a code list, add them in one shot with `.extend([codes])`:

```python
def svods_plus_anchors():
    result = currently_used_svods()
    result.extend([97, 98])        # one line instead of two appends
    return result
```

**Prefer `range(a, b)` over enumerated code lists when the codes are contiguous.** Spelling out `[1, 2, 3, 4, 5, 6, 7]` is verbose and fragile — a programmer can quietly skip or repeat a code and corrupt the survey path. `range(1, 7)` (inclusive both ends in this DSL) is unambiguous and survives renumbering.

```python
# ❌ Enumerated — easy to miscopy "5" twice or skip "4"
if Q1.selected.any([1, 2, 3, 4, 5, 6, 7]):
    hFlag.set(1)
for code in [1, 2, 3, 4, 5, 6, 7]:
    inputs.append(Q1.row(code).value)

# ✅ range() — single source of truth for the bound
if Q1.selected.any(range(1, 7)):
    hFlag.set(1)
for code in range(1, 7):
    inputs.append(Q1.row(code).value)
```

Use enumerated lists only when the codes are **non-contiguous** (e.g. `[1, 2, 3, 4, 5, 6, 97]` where 97 is the "None of the above" anchor).

**Extract a helper function when a boolean expression spans more than two rows / accessors.** A chain of `Q.row(1).selected.any([3]) or Q.row(2).selected.any([3]) or Q.row(3)...` is hard to read, hard to maintain, and hard to spot a missing row in. Loop instead:

```python
# ❌ Long disjunction — fragile and unreadable (and a condition cannot be wrapped onto a second line)
if Q6.row(1).selected.any([3]) or Q6.row(2).selected.any([3]) or Q6.row(3).selected.any([3]) or Q6.row(4).selected.any([3]) or Q6.row(5).selected.any([3]) or Q6.row(6).selected.any([3]) or Q6.row(7).selected.any([3]):
    hDaughter.set(1)

# ✅ Helper function with a loop
- script: |
    # True when any row of Q6 has "My daughter" (code 3) selected.
    def anyDaughterUser():
        for r in Q6.all:
            if Q6.row(r).selected.any([3]):
                return True
        return False

- qid: Q7
    if: anyDaughterUser()
    ...
```

The function name documents intent (`anyDaughterUser()` reads as English), the loop iterates `Q6.all` (so adding a row to Q6 automatically extends the check), and the gate is a single function call. Same principle for any "is there ANY row / iteration / segment where X is true" predicate.

If the value is already a numeric author-facing accessor (`single.value`, `number.value`, grid row value), you don't need to wrap it in `toInt(...)` — it's already a number. Drop the `toInt(v) < 3` clutter; just write `v < 3`.

If a value can be None for the comparison you're making, prefer the **`(value or 0)`** coalescing form over `value is not None and ...` — it reads as a single expression instead of a guard plus a check:

```python
# Verbose
if Platform.row(2).value is not None and Platform.row(2).value > 0:
    hUsesPlatform.set(1)

# Idiomatic
if (Platform.row(2).value or 0) > 0:
    hUsesPlatform.set(1)
```

---

## 12. `.set(...)` and other write-terminal mutators on question proxies

**`.set(...)` and `.reset()` on any question proxy give nothing back.** They only make the change. Which methods give a result and which do not is laid out in §11; this section is the per-type payload contract. (`quota(...)` no longer has a write method — see §15 for the deprecation note on `.fill()`.)

```python
Q1.set(2)            # ✓ correct — call on its own line
Q1.reset()           # ✓ correct
x = Q1.set(2)        # ✗ publish error `no-value` — a write gives nothing back
```

**Multi-call write idiom** — when you have several writes to do, each on its own line, never chained:

```python
hSegment.set(2)                  # a code that hSegment declares
hAvgRating.set(total / count)
hBestBrand.set(bestCode)
```

`.set(...)` takes any expression — `hCount.set((hCount.value or 0) + 1)` and `hQ7.set(1 if QBoxed.value == 1 else 2)` are both fine.

### Payload contract by question type

| Type | Payload form |
|---|---|
| `single` | `Q.set(2)` — one numeric option code |
| `multi` | `Q.set(2)` / `Q.set([1, 3])` / `Q.set({1: 1, 2: 0, 3: None})` (1=selected, 0=shown not selected, None=cleared) |
| `rank` | `Q.set([2, 1, 3])` — ordered list, no dups |
| `open` | `Q.set("text")` |
| `number` | `Q.set(12.5)` |
| `openList` | `Q.set({1: "Tea", 2: "Coffee"})` — keyed by row code, values are strings |
| `numberList` | `Q.set({1: 10, 2: 25})` — keyed by row code, values are numbers |
| `gridSingle` | `Q.set({1: 3, 2: 1})` — row → scale code |
| `gridMulti` | `Q.set({1: [2], 2: [1, 3]})` — row → scale code list |
| `lookup` (single) | `Q.set(value)` (single-step) or `Q.set(stepId, value)` (cascading) |
| `lookup` (multi) | `Q.add(value)` / `Q.remove(value)` — these are the multi-lookup write methods (also write-terminal) |

`.reset()` clears everything. For cascading lookup, `.reset(stepId)` clears that step and all later steps.

**Strict rules:**

- **Codes are numbers and must exist.** `Q1.set("2")` (text) and `Q1.set(9)` (no such option) are publish errors when the code is written literally, and runtime errors when it is computed. The same goes for row and scale codes in a payload, and for `multi.add(code)`.
- **The payload matches the type.** A number for `number`, text for `open` (`QOpen.set(5)` fails — write `QOpen.set(str(5))`), a list for `rank`, a dict for lists and grids.
- **No partial change.** An invalid payload leaves the prior value untouched.
- **Setting a question that is asked later is allowed** (prefill); *reading* one before it is asked only earns a warning in the editor.

---

## 13. Deprecated names — never author these

| Deprecated | Use instead |
|---|---|
| `type: text` | `type: open` |
| `type: textList` | `type: openList` |
| `type: gridText` | (not canonical) |
| `comment:` | `instruction:` |
| `list:` | `lists:` block |
| `input.max_char` | `input.maxChar` |
| `specify.max_char` | `specify.maxChar` |
| option `open:` / `open.size` / `open.max_char` | `specify` / `specify.size` / `specify.maxChar` |
| `show_if:` / `hide_if:` | `if:` |
| `.contains(...)` | `.any(...)` / `.every(...)` |
| `.has_any(...)` | `.any(...)` |
| `.has_all(...)` | `.every(...)` |
| `.iter`, `.iteration` | not canonical |
| `.labels` on a question | `selectedLabel` / `selectedLabels` / `allLabels` |
| `global://name` | `project://name` |
| Single-brace piping `{ var }` | Double-brace `{{ var }}` |
| Block comment `#[[ … #]]` | `#` on each line, or `- note: \|` (removed in engine v3.44.0) |
| `datetime.timedelta(...)`, date arithmetic | Not available — work with `.year` / `.month` / `.day` (§10.5) |
| `endSurvey("<custom outcome>")` | `"complete"` / `"terminate"` / `"quotafull"` only |
| `endSurvey("terminate")` with no page and no redirect; an info page placed after the script as the "exit page" | `endSurvey("terminate", TermPage)` and / or `redirectUrl(...)` on the next line (§6.7; refused at publish from engine v3.45.0) |
| `fail("en", "msg")` inline literal | `fail(QErrMsg.row(N).label)` — house standard, see §5.6 (the 2-arg form is supported by the runtime but defeats centralised translation) |

---

## 14. Stimulus HTML — what's allowed in `text` / `title` / `instruction` / `label`

Sanitized HTML fragments.

**Allowed tags:** `div`, `section`, `article`, `header`, `footer`, `main`, `nav`, `aside`, `figure`, `figcaption`, `p`, `pre`, `code`, `blockquote`, `strong`, `b`, `em`, `i`, `u`, `span`, `small`, `sub`, `sup`, `mark`, `h1`–`h6`, `br`, `hr`, `ul`, `ol`, `li`, `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `caption`, `colgroup`, `col`, `a`, `img`, `audio`, `video`, `source`, `track`, `iframe`.

**Allowed global attrs:** `class`, `id`, `title`, `role`, `style`, `aria-*`, `data-*`.

**Allowed URL protocols:** relative URLs, `https:`, `http:`, `mailto:`, `tel:`, `sms:`, `blob:`, `data:image/...`, `data:audio/...`, `data:video/...`. **Iframes** stricter — only relative or `https:`, always sandboxed.

**Blocked:** `<script>`, `on*` event handlers, `javascript:`, `expression(...)`, `url(...)` in inline style, `autoplay`. Executable JS belongs in `custom:` (§14b).

**Inline style:** layout/typography only (`display`, `width`, `margin`, `padding`, `border*`, `color`, `background*`, `font*`, `text-*`, `flex*`, `grid-*`).

---

## 14b. Custom code runtime — `custom:` in three scopes

`custom:` runs author HTML/CSS/JS **same-realm** (no iframe) alongside the survey. Three scopes with different lifecycles and DOM isolation:

| Scope | DSL shape | Runs | Isolation | Use for |
|---|---|---|---|---|
| **Question-level** | `custom:` as a question **property** | On every render of that question | **Shadow DOM** + wrapped script | Self-contained widgets — draggable shelf, image highlighter, calculator |
| **Survey-level** | `- custom:` as a **flow item** (like `- script:`) | **Once** on first flow-reach, no-op on re-entry, replayed on reload/reconnect/deep-link | Light DOM (page-level) + wrapped script | Shared modals, tooltips, delegated handlers used across many questions |
| **Page-level** | `custom:` as a **property on `- page:`** | On every render of that page | Light DOM; page's questions render into `data-jet-slot="…"` targets in the scaffold | Layout scaffolds — concept boards, shelf pages, side-by-side comparisons |

All three go through **one runtime** (`window.CustomRuntime`). Respondent and builder preview share the same code path — a widget looks identical in both.

**System of record is always the question.** Custom code is an input device; its output flows through `Jet.setValue(qid, value)` into a question, and from there validation, skip logic, quotas, piping, and export all see a normal answer.

### Function-wrapper params (question-level and survey-level)

The `<script>` inside `custom:` is lifted into a function wrapper. These names **just exist** as function params — never on `window`:

| Param | What it is |
|---|---|
| `Jet` | The runtime bridge. `Jet.setValue(qid, value)` is the ONLY durable write channel — flows into the question's answer store. `Jet.getValue(qid)` reads. |
| `root` | **Question-level only.** The shadow root. Use `root.getElementById(…)` / `root.querySelector(…)` instead of `document` so queries stay scoped. |
| `state` | **Question-level only.** A stable per-question object that survives re-visits within a warm page. Cache expensive things here (chart instance, parsed dataset) — the runtime re-runs your script every render. **NOT durable** — dropped on hard reload. Only `Jet.setValue` persists. |

### Question-level example — shadow DOM widget

```yaml
- qid: QDots
    type: number
    text: Tap dots, then confirm the count below.
    custom: |
        <style>
          .dot { width:24px; height:24px; margin:4px;
                 background:var(--jet-primary); border-radius:50%; cursor:pointer }
          .dot.on { background:var(--jet-accent) }
        </style>
        <div id="grid"></div>
        <script>
          var tapped = 0;
          for (var i = 0; i < 12; i++) {
            var dot = document.createElement('div');
            dot.className = 'dot';
            dot.addEventListener('click', function () {
              if (this.classList.contains('on')) return;
              this.classList.add('on');
              tapped++;
              Jet.setValue('QDots', tapped);
            });
            root.getElementById('grid').appendChild(dot);
          }
        </script>
```

Theme tokens (`--jet-primary`, `--jet-accent`, etc.) pierce the shadow root so widgets pick up survey theming for free.

### Survey-level example — light-DOM modal, install-on-reach

```yaml
- custom: |
    <style>
      .cx-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.6);
                     display:none; align-items:center; justify-content:center;
                     z-index:9999 }
      .cx-backdrop.open { display:flex }
    </style>
    <script>
      // Installs once on first flow-reach. Persists for the session.
      var back = document.createElement('div');
      back.className = 'cx-backdrop';
      document.body.appendChild(back);
      // ... event handlers wire the modal ...
    </script>
```

Legal anywhere a flow item is legal — root, inside `if` / `elif` / `else` / `loop` / `page` / `block`. **A `- custom:` behind an untaken branch is correctly not installed** (activation is by flow-reach, not by parse). Replay: on reload / reconnect / deep-link, the runtime re-installs the reached set in the same order.

### Page-level example — layout scaffold with question slots

```yaml
- page:
    id: conceptPage
    custom: |
        <div class="concept-page">
          <div class="hero"><img src="https://cdn.example.com/hero.jpg"></div>
          <div class="rating" data-jet-slot="QAppeal"></div>
          <div class="reason" data-jet-slot="QWhy"></div>
        </div>
    questions:
        - qid: QAppeal
            type: single
            options: appealScale5
        - qid: QWhy
            type: open
            style: textarea
```

The engine renders each question exactly as normal (real inputs, validation, Jet writes, `collectStepAnswer`). The client then **relocates** each rendered question card into its `data-jet-slot="qid"` target. Questions stay fully functional; the author owns the layout.

### Rules of thumb

- **Every write through `Jet.setValue`** — never write to `window`, never store answers in `state`, never hit `localStorage` for the answer (unless you also `Jet.setValue`).
- **Never overwrite the respondent's answer** with a fresh mount value — check `Jet.getValue(qid)` on mount and only initialize if it's null.
- **Don't use `document.getElementById` from question-level custom** — use `root.getElementById` so you don't collide with other questions.
- **Question-level `custom:` is per-question**; you can't share state across questions there. For cross-question shared state, use survey-level `- custom:` in light DOM (its scripts CAN read/write window namespaces).
- **Survey-level runs once per session**, even if the flow re-enters the block. If you need per-entry logic, use `- script:` (Python) not `- custom:` (JS).

### !HUMAN handoffs

Custom code is a joint AI-programmer + human-programmer surface:
- The AI programmer **can** author simple widgets when the qnr's intent is explicit (a tap counter, a slider readout, a formatted display).
- The AI programmer **should NOT** author complex widgets, third-party embeds (charts, maps, video players), or anything requiring external network access. Flag with `!HUMAN — custom widget: <intent>` in the delta-log and leave a stub.

---

## 15. Quotas — author surface

> **Quota cell definitions are created by the human programmer in the Quota Builder.** AI does not generate cell tables. But AI **does** author scripts that *read* from quota cells (least-fill assignment, conditional gates, monitoring) and routes the complete fill via `endSurvey("complete", CompletePage)`.

### 15.1 The runtime quota accessor

**Signature:** `quota(groupId, cellCode)` — **strictly two arguments**. There is no single-arg auto-match form; the author always supplies the resolved cell code. An unknown `groupId` or `cellCode` **fails closed** (treated as full, respondent is screened out) so a typo never silently routes someone into an untracked cell.

**Counting model — read this first.** The engine counts each qualified respondent **once, automatically**, when they reach `endSurvey("complete", CompletePage)` — it atomically evaluates and fills all of that respondent's matching cells. **This is the default and the only path you should use to count completes.** In scripts you only ever *read* a cell (`.isOpen` / `.isFull`) to gate the flow — you never increment it yourself.

> **⚠ `endSurvey("complete", CompletePage)` COUNTS the fill. It does not SCREEN.** The auto-fill path only increments cells for respondents who *reach* `endSurvey("complete", CompletePage)`. A capped multi-dimension quota still requires an explicit **read-only gate** earlier in the flow — if you don't gate, over-quota respondents sail through to complete and overfill every cell. There is no "complete handles it" shortcut.

**Read accessors** (return a value):

| Accessor | Returns | Meaning |
|---|---|---|
| `.isOpen` | `bool` | `True` when the cell still has fill remaining; `False` when at target |
| `.isFull` | `bool` | `True` when `.count >= .target` (and `.target > 0`); inverse of `.isOpen` |
| `.count` | `int` | Current fills against this cell |
| `.target` | `int` | The cell's target (0 = uncapped monitor) |
| `.remaining` | `int` | `target - count`, clamped at 0 |

**No manual write method.** `quota(...)` is read-only — no `.fill()`.

> **⚠ Deprecated:** earlier versions of this reference showed `quota(group, code).fill()` as a manual single-cell fill. **Do not author it.** The method double-counts against cells that the auto-fill path also increments (reserves ahead), which corrupts the target-vs-actual math. It has been removed from the engine surface. The only correct write path is `endSurvey("complete", CompletePage)`, which evaluates all matching cells atomically for the respondent's full answer set.

#### Pattern A — single-dimension quota gate (cell code == dimension value)

Simplest case: the respondent's dimension value IS the cell code (e.g. 4 markets numbered 1–4, cell codes 1–4). No derivation needed.

```python
# Screen the respondent against the market quota. READ-ONLY test — no fill here.
cell = hMarket.value
if not quota("qtMarket", cell).isOpen:
    endSurvey("quotafull", QuotaFullPage)
# The eventual endSurvey("complete", CompletePage) is what increments the cell — exactly once.
```

#### Pattern B — multi-dimension quota gate (cell code derived from 2+ dimensions)

Most real screeners cross two or three dimensions (Age × Gender, Market × Age, Region × Segment). The engine's `quota(group, cellCode)` signature still takes a single `cellCode` — so the author derives it **by explicit mapping**, not by arithmetic, and stores it in a **hidden interlocked cell question** that mirrors the Quota Builder cell codes 1..N.

```yaml
# Dimension 1: age band (derived from the age question)
- qid: hAgeGroup
    type: single
    visibility: hide
    title: Age band for qtAgeGender derivation
    options:
        1: 18-34
        2: 35-54
        3: 55-64

- script: |
    if S2.selected.any([1, 2]):
        hAgeGroup.set(1)
    elif S2.selected.any([3, 4]):
        hAgeGroup.set(2)
    elif S2.selected.any(5):
        hAgeGroup.set(3)

# Dimension 2: gender (asked directly as S3)
#   S3.options: 1 Male / 2 Female / 3 Non-binary / 4 PNTA

# Interlocked cell question — one option per Quota Builder cell (1..N).
# This is a hidden single whose code IS the cell code; `.set(cell)` lands the
# respondent in that cell for export + analyst visibility.
- qid: hAgeGenderCell
    type: single
    visibility: hide
    title: Age × Gender interlocked quota cell (1-6)
    options:
        1: Male 18-34
        2: Male 35-54
        3: Male 55-64
        4: Female 18-34
        5: Female 35-54
        6: Female 55-64

# Derivation + gate.
# !HUMAN — the qnr defines cells for Male/Female only; Non-binary and PNTA
# have no cell. Options: (a) continue without a quota check (current), (b)
# terminate, (c) allocate to a fallback cell. Flag this in the delta-log.
- script: |
    ag = hAgeGroup.value
    g  = S3.value
    cell = None
    if   g == 1 and ag == 1: cell = 1  # Male 18-34
    elif g == 1 and ag == 2: cell = 2  # Male 35-54
    elif g == 1 and ag == 3: cell = 3  # Male 55-64
    elif g == 2 and ag == 1: cell = 4  # Female 18-34
    elif g == 2 and ag == 2: cell = 5  # Female 35-54
    elif g == 2 and ag == 3: cell = 6  # Female 55-64

    if cell is not None:
        hAgeGenderCell.set(cell)
        if not quota("qtAgeGender", cell).isOpen:
            endSurvey("quotafull", QuotaFullPage)
    # Unmapped (Non-binary / PNTA): no cell, no gate — they continue per !HUMAN above.
    # Engine auto-fills the matched cell on endSurvey("complete", CompletePage) later.
```

**Why an explicit if/elif chain, not arithmetic.** `cell = (g - 1) * 3 + ag` happens to work for 2 × 3 cells numbered 1–6 in a specific order, but it silently breaks the moment the Quota Builder reorders cells, inserts a new category, or uses non-contiguous codes. The explicit mapping is **the single source of truth** between the DSL and the Builder — the human reads it, confirms it against their cell table, and the AI never guesses an arithmetic encoding that nobody asked for. Flag any divergence between the if-chain and the delta-log'd cell list.

**Why a hidden interlocked cell question (`hAgeGenderCell`).** It gives the analyst a single column that answers "which quota cell did this respondent land in?" — valuable for cross-tabs, cell-balance checks, and debugging over/under-fill. It's also the single place a future flow (recontact, follow-up) can read the cell from without re-running the derivation.

**Three or more dimensions.** Same pattern — nest the if/elif chain or precompute two dimensions into an interlocked helper (e.g. `hRegionAge`) and then combine with the third. The cell count explodes fast; prefer narrower cell tables where the research question allows.

Group ids are author-chosen names that match what the human will configure in the Quota Builder. Use a stable convention (e.g. `qt<thing>`) and **document the required group + cell codes in a comment directly above the script**.

### 15.2 What the AI programmer authors

1. Make sure questions that feed quota dimensions exist with clean numeric codes (typically demos: `Gender`, `AgeBand`, `Region`).
2. For every capped quota group that crosses two or more dimensions, author the **derivation + interlocked hidden cell + read-only gate** triple from §15.1 Pattern B. Single-dim quotas use Pattern A directly.
3. Author least-fill / priority-fill **assignment scripts** that read open cells from a named quota and punch a hidden helper question (§16.10). Place a `# Prerequisite:` comment above the script naming the required quota group.
4. Place `endSurvey("complete", CompletePage)` at the end of each qualifying path so the engine evaluates and increments cells:
   ```yaml
   - script: |
       # Mark the qualified respondent as a complete — triggers quota cell increment.
       endSurvey("complete", CompletePage)
   ```
   Every gate ends on an end page too: `endSurvey("quotafull", QuotaFullPage)` (§6.7).
5. In the delta-log, list every quota group the survey expects, with the cell codes and (where known) the targets, so the human can build them in the Builder.

### 15.3 What the AI programmer does NOT author

- The quota group / cell rows themselves (Quota Builder)
- Cell targets (set in Quota Builder)
- Soft-reservation logic (platform-side feature)

---

## 16. Common authoring patterns

### 16.1 Screener with terminate

```yaml
- qid: SAge
    type: number
    text: What is your age?
    required: True
    min: 0
    max: 120

- if SAge.value < 18:
    - script: |
        endSurvey("terminate", TermPage)

# At the bottom of the file, above `- lists:` — the end page (§6.7):
- qid: TermPage
    type: info
    text: Thank you for your interest. Unfortunately you do not qualify for this study.
```

`SAge` is `required: True`, so it always has a value here. If the screener question could be skipped, gate first: `- if SAge.answered and SAge.value < 18:` — comparing an unanswered (`None`) answer with `<` is a runtime error (§10.0).

### 16.2 ZIP screener with `matchOnly`

```yaml
- qid: SZip
    type: lookup
    source: http://localhost:3001/lookup/target_zips
    source.value: zipcode
    source.display: zipcode
    source.matchOnly: True
    text: Enter your ZIP code

- if not SZip.matched:
    - script: |
        endSurvey("terminate", TermPage)
```

### 16.3 Brand-aware loop

```yaml
- qid: QBrandsAware
    type: multi
    text: Which brands have you heard of?
    options: brandList
    required: True
    min: 1

- loop:
    id: brandLoop
    options: brandList
    options.from: QBrandsAware.selected
    - qid: QUseFreq
        type: single
        text: How often do you use {{ brandLoop.selectedLabel }}?
        options: freqScale
        required: True
```

### 16.4 Conditional follow-up

```yaml
- qid: QSatisfied
    type: single
    text: How satisfied are you?
    options: satScale
    required: True

- qid: QWhyDissat
    type: open
    text: What was the main reason?
    style: textarea
    if: QSatisfied.selected.any([4, 5])
    required: True
```

### 16.5 Allocation summing to 100

```yaml
- qid: QAlloc
    type: numberList
    text: Allocate 100 points across these categories.
    options: spendCategories
    required: True
    sum: 100
    total: True
    min: 0
    max: 100
    validation: |
        total = 0
        for c in QAlloc.all:
            total = total + (QAlloc.row(c).value or 0)
        if total != 100:
            fail("Allocations must sum to 100. You have {{ total }}.")
```

`sum(QAlloc.values)` gives the same total in one call — a blank row is passed over (engine v3.44.1) — so the validation can also be written `if sum(QAlloc.values) != 100: fail("Allocations must sum to 100. You have {{ sum(QAlloc.values) }}.")`.

### 16.6 Multi with exclusive "None of these"

```yaml
- qid: QFeatures
    type: multi
    text: Which features do you use?
    required: True
    min: 1
    options:
        1: Search
        2: Filters
        3: Saved items
        99:
            label: None of these
            exclusive: True
            anchor: True
```

### 16.7 Pipe a previous answer

```yaml
- qid: QBrandPick
    type: single
    text: Which brand do you prefer?
    options: brandList

- qid: QBrandWhy
    type: open
    text: Why do you prefer {{ QBrandPick.selectedLabel }}?
    style: textarea
```

### 16.8 Mask shown options based on prior answers

```yaml
- qid: QAware
    type: multi
    text: Which brands are you aware of?
    options: brandList

- qid: QConsider
    type: multi
    text: Which would you consider?
    options: brandList
    options.from: QAware.selected
```

If `QAware.selected` is empty, `QConsider` has nothing to show and the engine **skips it automatically** — no `if:` guard is needed, and its data stays blank (§11 "Absence semantics").

### 16.9 Cross-question consistency check

```yaml
- qid: QLiving
    type: multi
    text: Which best describes your household?
    options:
        1: Live alone
        2: Live with a partner
        5: Live with roommates
        6: Live with siblings
        7: Single parent with children
        99:
            label: Prefer not to answer
            anchor: True
            exclusive: True
    validation: |
        # A condition stays on one line — split a long test into named parts.
        aloneWithOthers = QLiving.selected.any(1) and QLiving.selected.size > 1
        parentWithPeers = QLiving.selected.any(7) and QLiving.selected.any([5, 6])
        if aloneWithOthers or parentWithPeers:
            fail("Please review your answer.")
```

### 16.10 Aggregate across loop iterations

```yaml
- script: |
    # Average rating across every brand the respondent rated.
    # QRating_[c] is the dynamic cross-iteration accessor — see §6.3.
    total = 0
    count = 0
    for c in brandLoop.all:
        if QRating_[c].answered:
            total = total + QRating_[c].value
            count = count + 1
    if count > 0:
        hAvgRating.set(total / count)
```

### 16.11 Derived segment flag

```yaml
- script: |
    # Punch hSegment from age × spend for downstream routing.
    # Codes are numbers — the meaning lives in the option labels below.
    if QAge.value < 25 and QSpend.value > 100:
        hSegment.set(1)
    elif QSpend.value > 200:
        hSegment.set(2)
    else:
        hSegment.set(3)

- qid: hSegment
    type: single
    visibility: hide
    title: Segment
    options:
        1: Young premium
        2: High value
        3: Standard

- qid: QPriorityFollowup
    type: single
    text: Based on what you've told us, are these priorities right?
    if: hSegment.value == 1
    options:
        1: Yes, those match
        2: No, missing something
```

### 16.12 Least-fill quota-driven assignment (concept / cell / treatment)

Common in concept tests, conjoint-cell rotations, treatment arms, and any "assign one of N to this respondent and balance the fill" use case. The script reads the named quota's open cells and punches a hidden helper.

**Plain least-fill** — pick uniformly at random from whichever cells are still open:

```yaml
# Least-fill concept assignment.
# Reads open quota cells from the "qtconcept" group (created in the Quota tab)
# and picks randomly from whichever remain open, keeping fill balanced.
# Prerequisite: human creates a quota named "qtconcept" with cell codes 1–6
# matching the hConcept options below.
- script: |
    # Collect open quota cells; pick one at random and assign.
    candidates = set()
    for code in range(1, 6):
        if quota("qtconcept", code).isOpen:
            candidates.add(code)
    if len(candidates) > 0:
        p = random.choice(sorted(candidates))
        hConcept.set(p)

# Internal assignment holder — visibility: hide in production, show during testing.
- qid: hConcept
    type: single
    visibility: show
    title: Assigned concept (internal)
    options:
        1: Concept A
        2: Concept B
        3: Concept C
        4: Concept D
        5: Concept E
        6: Concept F
```

**Priority least-fill** — try a preferred cell first; fall back to random open if the preferred is full:

```yaml
# Priority least-fill assignment.
# Tries the priority concept first; falls back to a random open cell when full.
# Prerequisite: human creates a quota named "qtconcept" with cell codes 1–6.
- script: |
    # Priority concept is assigned first while open; otherwise pick random open.
    priority = 4
    candidates = set()
    for code in range(1, 6):
        if quota("qtconcept", code).isOpen:
            candidates.add(code)
    if len(candidates) > 0:
        if candidates.any([priority]):
            hConcept.set(priority)
        else:
            p = random.choice(sorted(candidates))
            hConcept.set(p)
```

**Notes on this pattern:**

- `range(start, end)` in this DSL is **inclusive on both ends** — `range(1, 6)` gives `[1, 2, 3, 4, 5, 6]`. Use it to walk a contiguous cell-code range.
- Always guard with `if len(candidates) > 0:` — if every cell is full and the assignment script runs, leaving `hConcept` unset will strand the deep dive (every pipe to `hConcept.selectedLabel` renders blank).
- Place this script **right before the first question that reads the assigned helper** (typically the deep-dive intro), so document order matches execution order.
- The hidden helper question (`hConcept`, `hHabit`, `hCell`, etc.) carries the assignment so the rest of the survey can pipe `{{ hConcept.selectedLabel }}` and gate on `if hConcept.value == ...`.
- When eligibility filters apply (e.g. only assign cells the respondent qualifies for), add the eligibility check inside the candidate loop:
  ```python
  for code in range(1, N):
      if respondent_qualifies_for(code) and quota("qtconcept", code).isOpen:
          candidates.add(code)
  ```

### 16.13 Derotation — moving loop answers into stable, named slots

**The problem.** A loop iterating over N possible concepts (or stimuli, treatments) creates iteration-suffixed columns in the wide export — `Q1_3`, `Q1_7` for a respondent who saw concepts 3 and 7. Across respondents the columns are sparse and meaningless without cross-referencing the assignment. Analysts hate this.

**Derotation copies each loop iteration's answers into named hidden questions**, one per (concept × loop question) pair, so the analyst reads `Q3Concept2` directly to get Q3 for Concept B — no lookup needed. The full worked file lives at `derotation_example.yml`.

**The pattern, in three parts:**

#### Part 1: Single-script multi-stage least-fill assignment

When two or more concepts get assigned per respondent, do all the picks in **one script** using `.minus()` to remove each pick before the next, then set the union into a hidden `multi` that drives the loop's `options.from:`.

```yaml
- script: |
    # Build candidates of open quota cells, pick concept 1, then pick concept 2
    # from the remaining open cells. hConcept (multi) carries the union for
    # the loop's options.from below.
    candidates = set()
    for code in hConcept.all:
        if quota("qtconcept", code).isOpen:
            candidates.add(code)
    if len(candidates) > 0:
        p = random.choice(sorted(candidates))
        hConcept1.set(p)
    newCandidates = candidates.minus(p)
    if newCandidates.size > 0:
        q1 = random.choice(sorted(newCandidates))
        hConcept2.set(q1)
    hConcept.set(hConcept1.selected.union(hConcept2.selected))

- qid: hConcept
    type: multi
    visibility: hide
    title: Assigned concepts (union — drives the loop)
    options: conceptList

- qid: hConcept1
    type: single
    visibility: hide
    title: Assigned concept 1 (internal)
    options: conceptList

- qid: hConcept2
    type: single
    visibility: hide
    title: Assigned concept 2 (internal)
    options: conceptList
```

`hConcept.all` iterates the full authored concept domain (5 codes here) — no need for a hard-coded `range()`. The script walks open cells, picks one for `hConcept1`, removes it from candidates, picks another for `hConcept2`, and finally writes the union into `hConcept` so the loop can read `hConcept.selected`.

**Optionally capture presentation order.** When the analyst needs to know which concept was shown first vs second (for exposure-order analysis or bias control), add a hidden `numberList` `hConceptPosition` that stores 1 / 2 against each shown concept code:

```yaml
- script: |
    # ... least-fill picks as above, then:
    hConceptPosition.row(p).set(1)
    hConceptPosition.row(q1).set(2)

- qid: hConceptPosition
    type: numberList
    visibility: hide
    title: Presentation order (1 = shown first, 2 = shown second)
    options: conceptList
```

#### Part 2: Loop with the questions to ask per concept

```yaml
- loop:
    id: conceptLoop
    options: conceptList
    options.from: hConcept.selected
    - qid: Q1
        type: single
        text: How appealing is {{ conceptLoop.selectedLabel }}?
        required: True
        options: appealOptions

    - qid: Q2
        type: single
        text: How likely would you be to buy {{ conceptLoop.selectedLabel }}?
        required: True
        options: likelyOptions

    # ... other per-concept questions: Q3 open, Q4 multi, Q5 gridSingle ...

    - script: |
        # Inline punch — runs once per iteration in this iteration's context.
        # Bare Q1/Q2/... resolve to this concept's answers;
        # conceptLoop.value gives the current concept code.
        # Read each question with its type-precise accessor (see table below).
        iter = conceptLoop.value
        if Q1.answered:                          # Q1 is single
            q("Q1Concept", iter).set(Q1.value)
        if Q2.answered:                          # Q2 is single
            q("Q2Concept", iter).set(Q2.value)
        if Q3.answered:                          # Q3 is open
            q("Q3Concept", iter).set(Q3.value)
        if Q4.answered:                          # Q4 is multi
            q("Q4Concept", iter).set(Q4.selected)
        if Q5.answered:                          # Q5 is gridSingle — punch row-by-row
            for c in Q5.all:
                q("Q5Concept", iter).row(c).set(Q5.row(c).value)
```

**Inline punch (at the end of the loop body) is the preferred form.** Bare qids in the script body resolve to *this iteration's* answers because the script runs inside the iteration context. `q("Q1Concept", iter)` dynamically names the destination slot. The punch executes once per iteration, immediately after the respondent finishes that concept's questions — no post-loop walk needed.

**Use the type-precise accessor for each question type** (see the full table in §6.3 just above):

- `single`, `open`, `number`, `lookup` (single) → `.value` — scalar
- `multi` → `.selected` — CodeSet
- `rank` → `.values` — ordered list
- `gridSingle` rows → `Q.row(c).value` — scalar scale code per row, punched row-by-row
- `gridMulti` rows → `Q.row(c).selected` — CodeSet of scale codes per row

Grids can't be bulk-copied via a single `.set()` — `gridSingle.set({...})` and `gridMulti.set({...})` take a row→value map (§12), not a question proxy. Always iterate `Q.all` and punch row-by-row inside the inline script.

**Post-loop alternative** — use only when the punch logic must span multiple loops or has to run outside the per-iteration context. Uses the `Qx_[c]` cross-iteration accessor (§6.3):

```python
for c in conceptLoop.all:
    if Q1_[c].answered:                         # Q1 is single
        q("Q1Concept", c).set(Q1_[c].value)
    if Q4_[c].answered:                         # Q4 is multi
        q("Q4Concept", c).set(Q4_[c].selected)
    if Q5_[c].answered:                         # Q5 is gridSingle — row-by-row
        for f in Q5_[c].all:
            q("Q5Concept", c).row(f).set(Q5_[c].row(f).value)
```

#### Part 3: Derotation slots — **organize by concept, not by question**

For N concepts × Q loop-questions, you need N × Q hidden slots. **Organize them in the file by concept first, then by question** — all of Concept 1's slots together (Q1Concept1, Q2Concept1, ..., QnConcept1), then all of Concept 2's, etc. The analyst's export reads better this way: all of one concept's data lives in one contiguous block, instead of having to jump across the file looking for Q1's per-concept rows.

```yaml
# ── Concept 1 derotation slots ───────────────────────────────────────────
- qid: Q1Concept1
    type: single
    visibility: hide
    title: Q1 → Concept A
    options: appealOptions

- qid: Q2Concept1
    type: single
    visibility: hide
    title: Q2 → Concept A
    options: likelyOptions

- qid: Q3Concept1
    type: open
    visibility: hide
    title: Q3 → Concept A

- qid: Q4Concept1
    type: multi
    visibility: hide
    title: Q4 → Concept A
    options: phoneBrands

- qid: Q5Concept1
    type: gridSingle
    visibility: hide
    title: Q5 → Concept A
    options: features
    scale: satisfiedScale

# ── Concept 2 derotation slots ───────────────────────────────────────────
- qid: Q1Concept2
    ...
# ... and so on for each concept
```

Slot naming: `<questionId>Concept<conceptCode>` matches what `q("Q1Concept", iter)` resolves to. **No `h` prefix** — these are analyst-facing export variables, not internal state. (The `h` prefix is reserved for purely-internal helpers like `hConcept`, `hConcept1`, `hConceptPosition`.)

**Slot type matches the source question type.** Q1 single → Q1ConceptN single. Q5 gridSingle → Q5ConceptN gridSingle with the same rows/scale. Mismatched types make `.set()` reject the punch.

#### Partial derotation — the alternative shape

Instead of N×Q slots, partial derotation uses K×Q slots where K = concepts shown per respondent. Slot names encode shown-position (`Q1Concept1shown`, `Q1Concept2shown`) and the analyst joins to `hConcept1` / `hConcept2` to know which concept each slot's data belongs to. Trade-off: fewer columns, but each column requires a join to interpret.

Use partial only when column count is a real constraint and the analyst pipeline supports the join. **Default to full derotation** otherwise — analyst-friendliness beats column count.

### 16.14 Capturing randomization order — the seed-mirror pattern

**The ask.** When a parent block uses `order: random` to shuffle sub-blocks (or any randomized container), analysts routinely want to know "which sub-block was shown first / second / third" for each respondent — for exposure-order analysis, bias control, and storyline reconstruction. Capture this in the data, don't make the analyst rebuild it.

**The principle — deterministic per-respondent seed.** The runtime picks a random permutation for an N-item `order: random` set **once per respondent** based on the survey seed, and applies the same permutation everywhere an N-item randomized set appears. Two `order: random` things with the same count permute the same way for the same respondent.

**The pattern — mirror the randomization in a hidden `numberList` of equal N.**

```yaml
- qid: hBlockOrder
    type: numberList
    visibility: hide
    order: random
    title: Block presentation order (1 = first, 2 = second, 3 = third)
    options:
        1: block1
        2: block2
        3: block3

- block:
    id: mainBlock
    title: Randomized block set
    order: random
    questions:
        - block:
            id: block1
            questions:
                - qid: Q1Aware
                    ...
        - block:
            id: block2
            questions:
                - qid: Q2Price
                    ...
        - block:
            id: block3
            questions:
                - qid: Q3Hours
                    ...

- script: |
    # Capture randomization order via the seed-mirror.
    # hBlockOrder.all walks codes in the resolved random order — same
    # per-respondent seed as mainBlock's randomized children. Walk it and
    # write the position counter into each row.
    i = 0
    for c in hBlockOrder.all:
        i = i + 1
        hBlockOrder.row(c).set(i)
```

`.all` on a question returns codes in the **effective shown domain order** — i.e. the order after `order:` resolution. With `order: random`, `.all` walks in the resolved random sequence. Because the seed is per-respondent, the hidden mirror's resolved sequence is the same as the parent block's. One short script captures everything — no scripts inside the blocks, no idempotency guards, no trip-wires.

**Constraints — the mirror only works when:**

1. **Same count.** The hidden mirror's row count equals the target's effective child count. 3 sub-blocks → 3 options. Off-by-one breaks the match.
2. **Same `order:` mode.** Both must use the same shuffle mode — `random`, `flip`, `reverse`, `alphabetical`, or `fixed` are all seed-deterministic and mirror correctly. **`randomEach` breaks the mirror** because it re-rolls per show; each surface gets an independent permutation.
3. **All children visible to the respondent.** If any sub-block has an `if:` that hides it for some respondents, the parent's effective N differs from the mirror's N and the permutations no longer match.

**Read-back.** Wide-export columns: `hBlockOrder_1`, `hBlockOrder_2`, `hBlockOrder_3`. To find "which sub-block was shown first", pivot to the row whose value is 1.

**When to use this:**
- Any randomized `- block:` whose sub-block exposure order matters analytically
- Concept-test parent blocks, multi-stimulus rotations, message-test panels
- Randomized option-orders inside a single question (use a hidden `numberList` mirror of the same option count and `order: random`)
- Anywhere "which X did they see first?" is a likely follow-up

The full worked file lives at `block_order_example.yml`.

#### Fallback: `- if True:` trip-wire (only when the seed-mirror constraints fail)

When a sub-block is conditionally hidden, or when sub-blocks use mixed `order:` modes that defeat the seed mirror, fall back to a per-sub-block trip-wire. Scripts can't be direct children of a `- block:` (out of contract, §6.2), but **`- if:` flow blocks can be**, and `- if:` accepts scripts. Place `- if True:` as the first child of each sub-block with the position-punch script inside, guarded by `if not hBlockOrder.row(N).answered:` for idempotency on re-visits.

```yaml
- qid: hBlockPosCounter
    type: number
    visibility: hide
    title: Block-position counter (internal)

- block:
    id: mainBlock
    order: random
    questions:
        - block:
            id: block1
            questions:
                - if True:
                    - script: |
                        # Trip-wire — fires once when block1 becomes active.
                        if not hBlockOrder.row(1).answered:
                            hBlockPosCounter.set((hBlockPosCounter.value or 0) + 1)
                            hBlockOrder.row(1).set(hBlockPosCounter.value)
                - qid: Q1Aware
                    ...
        # ... block2 and block3 with their own - if True: wrappers ...
```

**Prefer the seed-mirror.** The trip-wire approach adds boilerplate to every sub-block and depends on the `- if True:` workaround; use it only when conditional visibility or mixed `order:` modes rule out the mirror.

### 16.15 Softmax classifier from a typing tool (persona / attitudinal segmentation)

**The ask.** Vendor research teams ship a "typing tool" — a small batch of attitude / behavior questions whose answers feed a published multinomial logistic regression that assigns each respondent to one of N segments (attitudinal clusters, lifestyle types, personas). The same model is reused across surveys for the same study. Run the classifier live during fielding and punch the assigned segment into a hidden helper so downstream questions and the export can read it.

**The inputs.** A typing tool usually ships as an Excel / SPSS workbook with:
- A **Coefficients** sheet — one column per segment, one row per question item, plus an intercept row. Cells are floating-point regression coefficients.
- A **Calculator** sheet showing the formula structure (typically `intercept + SUMPRODUCT(inputs, coefs)`, then `EXP()`, then divide-by-sum).
- An **Instructions for Programmers** sheet describing the input ordering, response-code conventions, and any overrides (e.g. "if probability of segment X ≥ 0.30, assign segment X regardless").

The DSL job is to translate that workbook into:
1. A feature vector built from the host survey's typing-tool questions, in the **same order** as the coefficient sheet's rows.
2. A linear-score-per-segment computation.
3. Softmax + override + argmax.
4. A `.set()` on a hidden helper.

**The algorithm (canonical four-step):**

```
score[s] = intercept[s] + Σ (input_i × coef[s][i])     for each segment s
expScore[s] = exp(score[s])
prob[s] = expScore[s] / Σ expScore[s']                 softmax
assigned = argmax(prob[s])                              with any vendor-specified override
```

`math.exp(score)` and `math.e ** score` are equivalent here — both are supported (§10.5).

**Worked DSL skeleton:**

```yaml
- script: |
    # Persona segmentation — multinomial logistic classifier (8 segments, illustrative).
    # Linear score → exp → softmax → argmax with a vendor-flagged-segment 30% override.

    # ── Model parameters ──
    intercept = [
        -12.345678901234567890,    # segment 1  (placeholder — use the vendor value)
        # ... 7 more ...
    ]

    # Coefficient matrix — 8 segments × 25 features in TT1-TT2-TT3 order.
    coef = [
        [1.2345, 2.3456, 3.4567, ...],    # segment 1  (placeholders — use the vendor matrix)
        # ... 7 more rows ...
    ]

    # ── Build the input vector in the same order as coef columns ──
    inputs = []
    for i in range(1, 10):                       # TT1: 10 paired items, value 1 or 2
        inputs.append(TypingTool1.row(i).value or 0)
    for i in range(1, 8):                        # TT2: 8 agree/disagree items, value 1..4
        inputs.append(TypingTool2.row(i).value or 0)
    for code in [1, 2, 3, 4, 5, 6, 97]:          # TT3: 7 binary items (97 = None of the above)
        if TypingTool3.selected.any([code]):
            inputs.append(1)
        else:
            inputs.append(0)

    # ── Score, exp, sum ──
    expScores = []
    expSum = 0
    for s in range(0, 7):                        # 8 segments (0-indexed 0..7)
        score = intercept[s]
        for f in range(0, 24):                   # 25 features (0-indexed 0..24)
            score = score + inputs[f] * coef[s][f]
        e = math.e ** score
        expScores.append(e)
        expSum = expSum + e

    # ── Softmax probabilities ──
    probs = []
    for s in range(0, 7):
        probs.append(expScores[s] / expSum)

    # ── Vendor override: the vendor-flagged segment (segment 7) at p >= 0.30, else argmax ──
    if probs[6] >= 0.30:
        hSegment.set(7)
    else:
        bestIdx = 0
        bestProb = probs[0]
        for s in range(1, 7):
            if probs[s] > bestProb:
                bestProb = probs[s]
                bestIdx = s
        hSegment.set(bestIdx + 1)

- qid: hSegment
    type: single
    visibility: hide
    title: Persona / segment assignment
    options:
        1: Segment 1
        # ... 7 more ...
```

Generate the full file from the vendor's coefficient workbook — one segment per column, one feature per row, plus an intercept row — keeping every coefficient at full precision. It drops into any host survey that already has the typing-tool questions (`TypingTool1` / `TypingTool2` / `TypingTool3` here) with row/option codes matching the source workbook.

**Authoring rules for typing-tool classifiers:**

1. **Match the coefficient sheet's feature ordering exactly.** If the workbook lists TT1 items in rows 3–12 then TT2 in 13–20 then TT3 in 21–27, the input vector must concatenate in that order. Reordering breaks every assignment.
2. **Preserve full coefficient precision.** Float-truncating to 4 decimals can flip respondents near the 30% override boundary. Keep ~17 significant digits (the Python-subset uses 64-bit floats — same as Excel).
3. **Encode response values the way the vendor specified.** TT1's paired-statement coding (`1` left / `2` right), TT2's agree-disagree scale (`1..4`), TT3's binary multi-select — these are part of the model. Don't re-base them.
4. **Honor any vendor override.** "If P(segment X) ≥ T, assign segment X regardless" is a hard rule that bypasses argmax. Check it before the argmax.
5. **Place the script after the last typing-tool question.** Per §6.5, the classifier reads TT1/TT2/TT3 answers, so it has to run after they've been answered. The hidden `hSegment` destination sits immediately after the script.
6. **Gate by eligibility.** If teens / non-targets skip the typing tool, wrap the whole classifier block in the same `if:` that gates the typing-tool questions, so it doesn't crash on unanswered inputs.
7. **Don't re-fit in place.** When the vendor updates the model, regenerate the DSL file from the new workbook rather than editing coefficients by hand. Treat the DSL as a compiled artifact.

### 16.16 Master brand list — preserve data shape across products / markets

**The problem.** Ask "what brand of X did you buy?" once per product in a loop, and a respondent who picked tampons sees 14 tampon brands, the respondent who picked liners sees 19 liner brands, and the respondent who picked both sees both lists in two separate iterations. If each product has its own coded brand list (`liners` codes 1–19, `tampons` codes 1–14), then **code 5 means a different brand in each iteration** and cross-product analysis becomes a join nightmare.

**The pattern.** Define **one master brand list** that covers every brand that could appear across every product. Each code maps to exactly one brand globally — code 5 is always "Brand X" whether the iteration is liners, pads, or tampons. Per-iteration, mask out the codes that don't apply to the current product. The export columns end up shaped identically across products; the analyst reads code 5 the same way everywhere.

```yaml
- lists:
    periodBrandMaster:
        options:
            1: Always
            2: Carefree
            3: Cora
            4: Honest Co.
            5: Honey Pot
            6: L.
            7: Lola
            8: o.b.
            9: Organyc
            10: Playtex
            11: Rael
            12: Seventh Generation
            13: Stayfree
            14: Tampax
            15: U by Kotex
            16: Just A Period
            17: Liv by Kotex
            18: Saba
            19: Amazon Basics
            20: Store Brand
            21: 4period
            22: Bambody
            23: Dear Kate
            24: Hanes
            25: Diva Cup
            # ... etc — every brand that could appear in any product, one master code each.
            97:
                label: Some other brand
                anchor: True
            98:
                label: I don't remember
                exclusive: True
                anchor: True
```

```yaml
- script: |
    # Per-product brand applicability. Each entry lists the master brand codes
    # that DO apply to that product. Codes not listed are masked out in the
    # respondent's view of that iteration, but the export column space stays
    # uniform — so Q3_iter1_brand5 and Q3_iter2_brand5 always mean the same brand.
    PRODUCT_BRANDS = {
        1: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20, 97, 98],   # Liners
        2: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 97, 98], # Pads
        3: [1, 2, 3, 9, 10, 12, 13, 15, 17, 18, 20, 97, 98],                          # Overnight Pads
        4: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 20, 97, 98],                 # Tampons
        5: [3, 21, 22, 23, 24, 11, 12, 18, 19, 20, 97, 98],                           # Reusable Underwear
        6: [25, 97, 98],                                                              # Menstrual Cups
        7: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 15, 17, 18, 20, 97, 98],              # Disposable Period Underwear
    }

    def brandsFor(productCode):
        return PRODUCT_BRANDS[productCode]

- loop:
    id: periodProductLoop
    options: periodProductList           # the same list Q1 uses
    options.from: Q1.selected.minus([8, 9])
    - qid: Q3
        type: multi
        text: What brand(s) of {{ periodProductLoop.selectedLabel }} do you recall buying this last year?
        instruction: Select all that apply.
        required: True
        min: 1
        options: periodBrandMaster
        options.from: brandsFor(periodProductLoop.value)
```

**Result on export.** The wide export columns are `Q3_1_<brand>`, `Q3_2_<brand>`, … per iteration code. Because `brand` is the master code (1–25 + anchors), every iteration column space is identical. Cross-product analysis filters / pivots without remapping.

**When to use this:**
- Any per-product / per-stimulus / per-cell brand grid in a multi-product or multi-market study.
- Anywhere the analyst is likely to pivot or stack across iterations and needs codes to mean the same thing everywhere.
- Multi-country surveys where brand availability differs per market — same pattern, market-level mask via `hCountry.value`.

**When NOT to use this:**
- When the qnr explicitly assigns different codes per product (and the analyst pipeline expects per-product code spaces). Honour the qnr.
- When the brand universes are entirely disjoint (no possible cross-product analysis) — separate qids per product with separate lists is fine then.

**Rule of thumb:** if the same brand can appear in two different product contexts, give it one master code and mask per context. Don't make the analyst re-key code 5 from "Cora-as-liner" to "Cora-as-tampon" — they'll thank you for the unified code space.

### 16.17 Straightliner detection on a grid

A respondent who picks the same column for every row of a grid is the classic low-quality response — they didn't read the items, they tapped down the page. Flag them in a hidden, or terminate when the pattern repeats across multiple grids.

**Canonical one-liner:**

```python
# True if every answered row of Q5 has the same value (= straightliner).
if min(Q5.values) == max(Q5.values):
    hQ5Straight.set(1)
else:
    hQ5Straight.set(2)
```

Why the shorthand works: if the smallest and largest values in the row vector are equal, every row must hold the same value. One expression replaces a `for` loop comparing each row to the first.

**Combined-grid terminate** (the usual stronger rule — one grid could be coincidence, two on unrelated batteries is a pattern):

```python
- script: |
    # Flag straightlining on Q5 and Q7; terminate when both grids are straightlined.
    s5 = min(Q5.values) == max(Q5.values)
    s7 = min(Q7.values) == max(Q7.values)
    hQ5Straight.set(1 if s5 else 2)
    hQ7Straight.set(1 if s7 else 2)
    if s5 and s7:
        endSurvey("terminate", TermPage)
```

**Edge to watch:** `min` / `max` pass over blank rows, so a grid with some rows unanswered is judged on the rows that were answered. With **every** row blank both give `None`, and `None == None` is True — a skipped grid would be flagged. On an optional grid, gate with `.answered` (`if Q5.answered and min(Q5.values) == max(Q5.values):`), or build the list yourself:

```python
filled = []
for c in Q5.all:
    v = Q5.row(c).value
    if v is not None:
        filled.append(v)
if len(filled) > 0 and min(filled) == max(filled):
    hQ5Straight.set(1)
```

Related shortcuts in the same vector-thinking family:

| Goal | Shorthand |
|---|---|
| All rows zero | `sum(Q.values) == 0` |
| All rows = 1 (yes/no grid) | `len(Q.values) == sum(Q.values)` |
| Used full scale range | `min(Q.values) == 1 and max(Q.values) == 5` |
| Average | `avg(Q.values)` |
| Any row above threshold | `max(Q.values) >= 4` |

**Lean on `min` / `max` / `sum` / `len` / `avg` over `.values` before writing a forloop.**

---

## 17. Common mistakes — never do these

1. ❌ Single-brace piping `{ var }` — use `{{ var }}`.
2. ❌ `fail("en", "literal message text")` for new authoring. The 2-arg locale form is runtime-supported, but the house standard is `fail(QErrMsg.row(N).label)` — single-arg piped from a central list (§5.6).
3. ❌ `selectedLabel` on `multi` — use `selectedLabels.at(0)`.
4. ❌ `options:` on a child question inside `mixGrid columns:` — domain inherited from parent.
5. ❌ `script:` inside a `block:` — keep scripts top-level.
6. ❌ `block:` / `loop:` / `script:` directly inside a `page:` — pages allow only `qid` and nested `page`.
7. ❌ `questions:` wrapper between a parent `page:` and nested `page:` — nested pages sit directly.
8. ❌ Tabs or 2-space indent — strict 4-space.
9. ❌ String option codes. Always numeric.
10. ❌ Lowercase `true` / `false`. Always `True` / `False`.
11. ❌ `show_if:` — use `if:`.
12. ❌ `//` — use `int(a / b)`. `switch` — use `if/elif/else`. List comprehensions — use explicit `for`. (`.replace(old, new)` and `.find(text)` **are** supported from engine v3.44.0.)
13. ❌ `import math` (or any import) — modules are pre-imported; just call them.
14. ❌ `f"..."` strings, `"%s" % x` / `.format()` text formatting, walrus `:=`, lambdas, decorators, classes, default parameter values — all refused. Join text with `+` and `str(...)`.
15. ❌ Block comments `#[[ … #]]` — removed in engine v3.44.0 and now a publish error. Use `#` on each line, or `- note: |` between blocks. (`break` / `continue` are **allowed** from v3.44.0.)
16. ❌ Using `.answered` to gate a screenout on a `matchOnly` lookup — use `.matched`.
17. ❌ Forward references in scripts (helper used before definition).
18. ❌ `total: True` to mean "validate the sum" — `total:` only controls *display*; use `sum:` and/or `validation:`.
19. ❌ Reading a respondent answer before its question is shown. Setting forward (`Q.set(...)`) for prefill is fine.
20. ❌ Multi-select on cascading lookup or with `source.matchOnly: True` — both reject `multi: True`.
21. ❌ Authoring `cardSort` / annotation modules in DSL — leave a stub and flag. The opposite holds for `cbc` / `maxdiff`: ❌ leaving a stub or deferring to a "CBC wizard" (there is none) — write them in full (§2.1); and ❌ reading the choice with `.chosen` (it does not exist) — use `QCbc.task(T).selected` / `.level(A)`.
22. ❌ Authoring quota cells in DSL — human-task.
23. ❌ Stopping mid-document to ask a clarifying question — code best-effort and put it in the delta-log.
24. ❌ Comparing `request.param("...")` to `None`, or using it bare as a test (`if not request.param("src"):`) — it is text, `""` for missing keys. Write `request.param("src") == ""`.
25. ❌ Inventing qid prefixes when the qnr already uses an alphanumeric name. `Gender` stays `Gender`, never `SGender` / `QGender`. Prefix only when the qnr labels with pure numbers (`1`, `2`, ...).
26. ❌ Wrapping a single standalone question in `- page:`. Pages exist to group two-or-more questions on one screen; a lone question is its own one-screen unit at the top level.
27. ❌ Inline string literals inside `fail(...)`. House standard: every `fail()` pulls from `QErrMsg.row(N).label` (§5.6). Translation, copy review, and consistency all depend on this.
28. ❌ Bundling every helper script at the top of the file. **Co-locate** each script with the question it serves (§6.5). Derived-value punches go right after the source question; masking helpers go right above their consumer.
29. ❌ Adding an `if: len(helper()) > 0` guard to every masked question. From engine v3.44.0 a question whose `options.from:` / `scale.from:` leaves nothing to show is **skipped automatically** and its data stays blank. Add an `if:` only when the question should be hidden for some *other* reason.
30. ❌ A `- script: |` block with no `#` comment. Every script needs at least one short comment naming what it does — the next reader's first lookup.
31. ❌ Hand-rolling iteration when an accessor exists. `Q.selected.size` over manually counting. `code in Q.selected` over `Q.selected.any([code])` for a single code. `sum(Q.values)` over `for c in Q.all: t += Q.row(c).value` — blank rows are passed over (§11 "Authoring style").
32. ❌ Wrapping author-facing numeric accessors in `toInt(...)`. `single.value`, `number.value`, grid row values are already numeric — `toInt(Q.value) < 3` is just `Q.value < 3`.
33. ❌ Organizing derotation slots by question (`Q1Concept1`, `Q1Concept2`, …, `Q2Concept1`, …). Group **by concept** instead — all of Concept 1's slots (Q1Concept1…QnConcept1) together, then Concept 2's. Analyst reads one concept's full panel in one place (§16.13).
34. ❌ Defaulting to the post-loop `Qx_[c]` punch when inline would work. **Inline punch inside the loop body is preferred** — bare qids resolve to the current iteration automatically, no cross-iteration accessor needed. Reserve `Qx_[c]` for cases that genuinely span multiple loops or run outside the per-iteration context.
35. ❌ Splitting two-stage least-fill into two separate scripts. Do all the picks in **one script** with `.minus(p)` between them, then write the union into a `multi` for the loop's `options.from`. Cleaner, single source of truth.
36. ❌ Shipping a survey with a randomized parent block but no order-capture. Analysts will ask "which sub-block did the respondent see first?" — bake it into the data with a hidden `hBlockOrder` numberList mirroring the target via the seed-mirror pattern (§16.14). One hidden list, one short post-block script — no trip-wires unless conditional visibility forces the fallback.
37. ❌ Referencing a qid in `options:`. `options:` takes a list name (defined in `- lists:`) or an inline `code: label` block — never another question's id. To filter one question by another's selection, use `options.from: OtherQ.selected` paired with `options: someListName`.
38. ❌ Placing a punch script far from the hidden question it writes. Scripts execute on traversal (§6.5) — the punch must sit **immediately before the hidden destination**, with the destination's `- qid:` defined right after. Anything between a top-of-file hidden definition and a far-away punch script that reads the hidden gets a null. Hidden helpers with **no** punch (pipe tables, error-message banks) can still live at the top.
39. ❌ Defining a masking helper after its consuming question. `def`s used by `options.from:` / `scale.from:` must be defined before traversal hits the consumer — place the script `def` immediately above the masked question, never below.
40. ❌ Assuming `q(baseName, code)` inserts a separator. It concatenates — `q("QRating", 1)` resolves to `QRating1`, NOT `QRating_1`. For loop cross-iteration access include the underscore yourself: `q("QRating_", c)`, or use the bracket-proxy form `QRating_[c]` (§10.8). For derotation slots like `Q1Concept1` the no-separator concatenation is exactly what you want — `q("Q1Concept", iter)` is correct.
41. ❌ Carrying source-document formatting artifacts into the DSL. `[Q_Age]`, `{QBrand}`, `Q1.a`, `Q1.1` aren't valid identifiers — strip the delimiters per §1 "Normalizing identifiers and codes". `[Q_Age]` → `QAge`; `Q1.a` → `Q1a` (letter boundary, concatenate); `Q1.1` → `Q1x1` (digit boundary, insert `x` to avoid colliding with `Q11`).
42. ❌ Keeping alphabetic option codes (`a.`, `b.`, `c.`) from the qnr in the DSL. Hard Rule #2 — codes are numeric. Convert in source order: `a.` → `1`, `b.` → `2`, etc. Same for Roman numerals.
43. ❌ Underscores in DSL identifiers. Per the current design, qids, loop ids, page ids, block ids, and list names use letters and digits only — camelCase, no underscores. `Q_Age` → `QAge`, `S_zip` → `SZip`, `brand_loop` → `brandLoop`, `demographics_page` → `demographicsPage`. When the underscore sits between two digits (`Q1_1`), strip it AND insert `x` to avoid collision with sibling qids: `Q1_1` → `Q1x1`, never `Q11`. The rule applies to author-chosen DSL identifiers; Python variable/function names inside `- script:` blocks follow Python convention and may still use underscores (e.g. `currently_used_svods()`, `is_premium_buyer()`).
44. ❌ Embedding translations in a multi-country DSL. English is the master; the translator module (UI or XML import) handles every other language. AI writes `text: What is your age?` in every survey regardless of how many markets it ships to.
45. ❌ Gating country-specific questions on `request.param("lang")` directly. Punch a hidden `hCountry` single once at the top of the file from the lang param, then have every gated question read `if: hCountry.value == N`. Single source of truth, single place to update if the lang→country mapping changes.
46. ❌ Inventing a new prefix for hidden helpers the qnr already names. The SHOPPER doc declares `HQDAGE`, `HQGEN`, `HQREGION` — those qids stay verbatim because the analyst refers to them by those names. The `h` prefix is only for hidden helpers AI introduces beyond the qnr (`hCountry`, `hSegment`, `hHabit`).
47. ❌ `gridMulti` `Q.selected` or `Q.selected.size` at the question level. The question-level accessors are `all` / `allLabels` / `answered` / `notAnswered` only — no `selected`, no `selected.size`. Reach selections through `Q.row(r).selected` per row, and extract a helper function (§11) for any predicate that spans multiple rows.
48. ❌ Enumerated code lists where `range(a, b)` would do. `Q.selected.any([1, 2, 3, 4, 5, 6, 7])` is fragile — write `Q.selected.any(range(1, 7))`. Enumerated lists are only for non-contiguous codes (anchors like 97, 98, 99 mixed with 1-N).
49. ❌ Long boolean disjunctions across many rows / accessors. `Q.row(1).x.any([3]) or Q.row(2).x.any([3]) or ... or Q.row(7).x.any([3])` should be a helper function looping `Q.all` (§11). Adding a row later will silently bypass the gate otherwise.
50. ❌ Inline `if:` on every member of a multi-question gated section. When 2+ consecutive questions share a gate, wrap them in a `- if <expr>:` flow block (§6.4) — one gate, one place to change, easier to audit. Inline `if:` is for one-offs or when the gate differs per question.
51. ❌ Programming separate qids per country (`S6US`, `S6AU`, `S6BR`, `S6ID`, or `S7US`/`S7AU`/`S7ID`) when the qnr shows market-specific labels in a table but the **code count is compatible**. **One qid, one set of codes** — the translator module fills per-language / per-market labels in its own pane. The mockup at `surveyDsl/mockup/translations.html` shows the per-question container pattern. Only create per-country qids when (a) the qnr literally names them separately, (b) the **code scales** differ structurally (e.g., S7 with 8 codes vs S8 with 10 codes — different code spaces), or (c) stakeholders explicitly want per-country columns and confirm codes aren't comparable across markets.
52. ❌ Capturing the return value of a **write-terminal** mutator. `Q1.set(...)`, `Q1.reset()`, `Q1.row(c).set(...)`, `q("Q1").set(...)` always return `None` (§11 / §12). Assigning the result (`x = Q1.set(2)`) is a publish error (`no-value`). Call them on their own line. The same holds for the in-place methods of a list or dict you built — `.append`, `.extend`, `.remove`, `.sort`, `.clear`, dict `.set(k, v)`. Only the **survey-collection** methods (`.add`, `.remove`, `.intersect`, `.union`, `.minus` on `Q.selected` / `Q.all` / …) return a new value that is safe to store or chain.
    - **Note:** `quota(group, code).fill()` was previously listed here as a write-terminal mutator; the method itself has been removed from the engine (double-counted with the auto-fill path on `endSurvey("complete", CompletePage)`). See §15.
53. ❌ Chaining `.set()` on a question proxy. `Q1.set(2).reset()` won't work — the first call gives nothing back. Use separate lines for each write. Chaining is only valid on survey collections (`Q.all.minus([97]).union([5])`) and text.
54. ❌ Dropping `.selected` from a membership test. The accessor is `Q.selected.any([codes])` on **both single and multi** — there is no `Q.any(...)` form. Per `the bundled single-type example` line 145–146: `Q.selected.any(N)` and `Q.selected.any([1, 2])` are the canonical reads. On `single`, `Q.value == N` is also valid for one code, but for two-or-more codes prefer `Q.selected.any([N1, N2])` over a chain of `or`s (easier to extend, easier to scan). Worked example: `QH.selected.any([1, 2])` ✓ — not `QH.any([1, 2])`. **Cross-check chat shorthand against this authoring reference / the bundled examples before applying** — chat examples are easy to misread, the doc is the source of truth.
55. ❌ Forgetting that lists (`- lists: foo:`) are static authoring constructs, not runtime objects. `.all` works on **questions and loops**, not on shared lists. To enumerate codes a list defines, iterate from a question that uses the list (`for code in Q7.all:` not `for code in proteinList.all:`). Bonus: `Q.all` honors `options.from` masking — it reflects what the respondent saw, not the static authoring list.
56. ❌ Using a value as a condition. `if`, `elif`, `while`, `and` / `or` / `not`, a question's `if:` and `- if …:` all need a yes/no test — `if hFlag.value:`, `if Q.selected:`, `if not QName.value:` and `if: 1` are publish errors (`not-a-condition`). Write `if hFlag.value == 1:`, `if Q.selected.size > 0:`, `if QName.value == "":`. Likewise `Q.answered == 1` / `== 0` is refused — `.answered` is True / False: write `Q.answered` / `not Q.answered`. (The inline form `a if cond else b` **is** allowed everywhere from engine v3.44.0, including inside `.set(...)`.)
57. ❌ Inventing an `h` / `H` / `HQ` prefix when the qnr already names a hidden question. Analysts look for hidden helpers by the qnr name — if the doc says "Q9" for the protein assignment or "Q10F" for the hidden rank, use `Q9` / `Q10F`, not `HQProtein` / `HQ10FRank`. The `h`-prefix soft convention applies **only** to hidden helpers AI introduces beyond the qnr (`hCountry`, `hSegment`, `hTrapCount`, etc.).
58. ❌ Arithmetic or `<` / `>` on an answer that may be unanswered. An unanswered coded or numeric answer is `None`, and `None + 1` or `None < 3` is a runtime error — in a validation the respondent sees a generic "problem checking this answer" message. Coalesce or gate:

    ```python
    # ❌ Fails the first time through, when HQTrapCount is still unanswered
    HQTrapCount.set(HQTrapCount.value + 1)

    # ✅ Coalesce None to 0 — a compound expression inside .set(...) is fine
    HQTrapCount.set((HQTrapCount.value or 0) + 1)
    ```

    Same rule for any accumulator. (`sum()` / `avg()` / `min()` / `max()` over a **list** are the exception — they pass over blank rows.)
59. ❌ Comments inside a `lists:` / `- lists:` block at the same indent as the list's child keys. The DSL parser doesn't reliably attach those comments to the right node — keep list-block comments **above the list name** (one level up), or indent them deeper than the data keys. Worked example:

    ```yaml
    # ✅ Comments live above the list name (preferred — outside the list block)
    # Chicken codes 2/3/4 grouped together so randomization keeps them as one block.
    proteinList:
        group:
            ...

    # ❌ Comments at the same level as the list's child keys confuse the parser
    proteinList:
        # Chicken codes 2/3/4 grouped together ...
        group:
            ...
    ```

    Applies to `- lists:`, `- scales:`, `- groups:` blocks. Same rule for any block where a child key follows.
60. ❌ Modeling "show what you said before next to a new entry" as a single column. When the qnr wants a **pre / post pair** ("What you told us earlier" + "What you think now", or any other before/after reminder layout), use `mixGrid` with two columns — the first `readonly: True` and pre-populated by a script that copies the earlier values, the second editable for the new entry. Column types can be any of the supported child types (`numberList`, `single`, `multi`, `open`, scale, etc.) and don't have to match — pre might be a `single` echoing an earlier choice while post is a `numberList` for new allocations. The general pattern: **readonly echo + editable new entry, paired in one mixGrid**. Single-column rendering loses the side-by-side reminder the design intends.
61. ❌ Assuming a piped subset of a randomized parent still gets its own independent reshuffle. **Engine v3.38.0 fixed the duplicate-shuffle bug**: the respondent render no longer carries a second shuffle on top of the engine's one. A piped subset (`options.from: QBrand.selected`) now **inherits the parent's shown order** — not an independent reshuffle. This is research-methodology correct and matches `Q.all` / `Q.selected`, but a legacy survey that relied on the broken reshuffle will see its displayed order change (data unaffected — stored by code). If you genuinely need an independent reshuffle on the child, give the child its own `order: random` **and** be aware that stored codes stay the same (§3.6 behavior-change note). Related: for a loop that must iterate in the parent's shown order, use `options.from: QBrand.selected` + `order: QBrand.all` (expression form, §6.3) — no helper required.
62. ❌ Adding `order: Q.all` to a question whose `options.from:` already pipes from the parent. Redundant — the engine v3.38.0 auto-inheritance already produces that sequence. The expression form on `order:` / `scale.order:` is reserved for surfaces that **don't** auto-inherit: **loops** (iteration order follows source shown order) and **blocks** (child-block sequence from a stored `[2,4,1,3]`-style list). On questions, the resolver gets the right answer with just `options.from:` — leave the question clean. Worked example: `options.from: q1BrandsAware()` on a `multi` Q2 is enough; `order: Q1.all` on top is dead code. (§3.6, §6.3)
63. ❌ Hand-computing a multi-dim quota cell code with arithmetic. `cell = (ag - 1) * 2 + g` works only when the Quota Builder numbers cells in exactly that order with exactly that stride — change the cell table and the arithmetic silently maps every respondent to the wrong cell. Write the full if/elif mapping instead (§15.1 Pattern B): one row per cell, label-commented, matching the Builder table 1:1. The DSL mapping is the author–Builder contract; arithmetic hides that contract behind a formula no reviewer can audit against the qnr. Flag any divergence between the mapping and the delta-log'd cell list.
64. ❌ Dropping the quota gate because "`endSurvey("complete", CompletePage)` auto-fills." `endSurvey("complete", CompletePage)` **counts**, it does not **screen**. Removing the read-only `quota(...).isOpen` test means every over-quota respondent completes and gets counted — the capped group overfills, not stops. A capped multi-dim quota always needs the explicit gate (§15.1 Pattern B). Correct over-correction when `.fill()` was removed: delete the write, keep the read. The structural pair is `if not quota(...).isOpen: endSurvey("quotafull", QuotaFullPage)` for the screen, and the eventual `endSurvey("complete", CompletePage)` for the count — both are required.
65. ❌ Rewording, rephrasing, re-punctuating, expanding, or "improving" an existing question's text, option labels, row labels, or validation error strings while making a change the user did not ask about. This is a **hard rule** (§0 #9) because it has data-integrity consequences, not a style preference. Field reports: an AI edit that added one new question also silently normalized "Strongly agree" to "Strongly Agree" across the whole 5-point grid, retitlecased half the brand list, and dropped the trailing full stops from four option labels — a change nobody asked for, in a survey already in field, that invalidated the collected data for every touched surface and forced a re-field. The failure mode is the AI treating "the file is being edited anyway, so let me tidy up" as polish; it is not. **Never touch wording the user did not name.** Scan the pre-edit text for every `title:` / `text:` / `label:` / scale / row / `validation:` string the edit passed near, and confirm each one is byte-identical to the input unless the request explicitly asked you to change it. Converting a fresh spec is the only time you author new copy; even then, copy **verbatim** from the source (same casing, punctuation, contractions, trailing periods) — if the spec has a typo and you keep it, mark the line `# verbatim: original spec`; if you fix it, log the fix in the `delta-log`. The AI never has implicit authority over copy — the client's questionnaire does.

66. ❌ Quoting a code, or giving a coded hidden question text values. `Q1.value == "2"`, `Q1.set("2")`, `hSegment.set("premium")`, `if: hSegment.value == "premium"` are all publish errors — codes are numbers. Give the hidden `single` numeric options whose **labels** carry the meaning (`1: Premium`, `2: Standard`) and write `hSegment.set(1)` / `hSegment.value == 1`. If free text really must be stored, the hidden question is `type: open`.
67. ❌ Using a code the question does not declare. `Q1.set(9)` on a 1–5 scale, `QGrid.row(12)`, `Q1.selected.any([1, 9])`, `hSegment.set(7)` when `hSegment` lists 3 options — each blocks publish (`unknown-code`). When a script punches a hidden question, declare **every** code the script can write.
68. ❌ `is None` on a text answer or a collection. `QOpen.value is None`, `QM.selected is None`, `len(v) < 5` guarded by `v is None or …` on an `open` value — text is `""` and collections are empty, never `None`, so the checker refuses the test (`mixed-kinds`). Write `not QOpen.answered`, `QOpen.value == ""`, `QM.selected.size == 0`, or simply `len(v) < 5`.
69. ❌ Continuing an `if` test onto a second line (with `\` or by wrapping brackets). Not accepted. Name the parts (`a = …`, `b = …`, then `if a or b:`) or move the test into a `def` helper.
70. ❌ `set(rows).add([97, 98])` to add several codes to a list you built. On a constructed set `.add` takes one value, so the list is nested and both codes are lost from the mask. Use `rows.extend([97, 98])`. (`Q.selected.add([97, 98])` on a survey collection is fine.)
71. ❌ `datetime.timedelta(...)`, date arithmetic, `.weekday()`, `.strftime()`. A date offers `.year`, `.month`, `.day`, `.isoformat()` (plus `.hour`, `.minute`, `.second` on `datetime.now()`) and nothing else (§10.5).
72. ❌ `endSurvey("screenout")` or any custom outcome. Only `"complete"`, `"terminate"`, `"quotafull"`.
73. ❌ `endSurvey("terminate")` on its own. Every `endSurvey` names an end page (`endSurvey("terminate", TermPage)`) or is followed on the next line by `redirectUrl(...)`; with neither it is a publish error (§6.7).
74. ❌ Writing an info page after a terminating script and expecting it to be the closing page. Position means nothing: name the page in the `endSurvey` call and keep end pages at the bottom of the file.
75. ❌ One end page per screen-out with the same text. Name the same `TermPage` from every terminate point.
76. ❌ Naming a hidden question, a non-`info` question, or a quoted name (`"TermPage"`) as the end page.
77. ❌ Anything between `endSurvey(...)` and its `redirectUrl(...)`, or a redirect URL without `https://`, or an invented panel link. The redirect is the very next statement, written in full, and only when the brief supplies the link.

---

## 18. List-extraction protocol — when authoring

1. While reading the doc, log each option list as you encounter it (mental note or a side scratchpad).
2. When the **same core list** appears a second time — even if one instance has extra "Other / DK / None" boilerplate — extract it to `- lists:` with a meaningful name and reference both questions by name.
3. If the variants disagree on boilerplate (some have "None of these", some don't), put the shared core inside the named list and add the boilerplate inline at the reference site (§5.5).
4. If error messages repeat across `validation:` blocks, build a hidden `QErrMsg` `multi` (§5.6) and pipe `QErrMsg.row(N).label` into `fail()`.
5. Place the final `- lists:` block at the bottom of the file, after all questions and flow logic.

---

## 19. Working from a Word document — the pipeline

When a `.docx` is dropped (manually or via the upload button), follow this in one pass:

1. **Extract** text via the `anthropic-skills:docx` skill. Preserve numbering, indentation, italics, bracket conventions, footnotes. Programmer instructions in [SQUARE BRACKETS] or {curly braces} usually carry routing, codes, exclusives, anchors, randomization notes.

2. **Frame** the structural skeleton — screeners, demographics, main section, exit. Lay down empty `- qid:` stubs with only `type:` and `text:`. **Normalize identifiers as you go** — strip delimiters around qids (`[Q_Age]` → `Q_Age`), collapse dotted sub-question labels (`Q1.a` → `Q1a`), and convert alphabetic / Roman option codes to numeric (`a.` `b.` `c.` → `1`, `2`, `3`). See §1 "Normalizing identifiers and codes from the source document".

3. **Classify each question**:
   - "Select one" / radio → `single`
   - "Select all that apply" / checkbox → `multi`
   - Ranking 1–N → `rank`
   - Open-end short → `open` (`style: text`); long → `open` (`style: textarea`)
   - Free text by item → `openList`
   - Single number → `number`
   - Number per row → `numberList`
   - Number per (row × column) cell → `gridNumber`
   - Scale per row, one answer → `gridSingle`
   - Scale per row, multiple answers → `gridMulti`
   - Multi-question table sharing rows → `mixGrid`
   - Pick-from-large-list → `lookup`
   - Read-only intro/outro → `info`
   - Choice-based conjoint → `cbc`; MaxDiff / best-worst scaling → `maxdiff` — both authored in full (§2.1); only the design upload is a human task
   - CardSort / annotation → stub only (human task)

4. **Code numerically.** Apply the list-extraction protocol (§18). Mark anchors / exclusives / specifies / DK-NA boilerplate. Default code conventions: `97` Other (specify), `98` Don't know, `99` None of these / Prefer not to say (with `anchor: True` and on `multi` typically `exclusive: True`).

5. **Author logic.** `if:` for show conditions, `validation: |` blocks (use the error-message bank pattern when messages recur), `script:` for derived flags and segment assignment, `endSurvey("terminate", TermPage)` for screenouts, `endSurvey("complete", CompletePage)` at the end of qualifying paths, and the end pages themselves at the bottom of the file (§6.7).

6. **Self-check** against §0, §11, §13, §17.

7. **Append a `delta-log`** as the final `- note: |` block — every assumption, every wizard handoff, every ambiguity resolved by best-effort. The human programmer reviews this and finishes the wizard-driven pieces.

```yaml
- note: |
    delta-log:

    AI-coded assumptions (review these):
    - QAge: doc said "adult" but no min — set min: 18.
    - Brand list assumed identical to QAware's list.
    - "Other (specify)" added to QReason because doc said "any other reason".
    - QSatisfied scale assumed 5-point (Strongly agree → Strongly disagree); doc was unspecific.

    Human handoffs (must complete via wizard or upload):
    - Quota: gender_age (QGender × QAgeBand) — build cells in Quota Builder.
    - Quota: total cap 1000 completes.
    - Lookup list: target_zips — upload ZIP-code data file with columns 'zipcode', 'state'.
    - Conjoint design: ConjointTask reads design 'PlanDesign' — upload the CBC design file (4 attributes: price, brand, speed, support) in Assets → Designs under exactly that name.
    - Custom JS module: QIntroVideo — author custom video player in Custom editor.
```

---

## 20. Workspace conventions

- Authored `.yml` survey output is the deliverable. The `.yml` extension is the platform standard.
- Write output only where your host integration directs; this reference and the bundled `examples/` are read-only inputs.
- Suggested layout when running as a batch tool:
  - `inbox/` — incoming source briefs (`.docx`, `.md`, …)
  - `out/` — generated `.yml` survey files
  - `notes/` — per-survey delta-logs and design notes
- Re-read this reference before each new authoring task. When in doubt, also consult the bundled worked examples in `examples/`.
- Before declaring any task done, run the linter (§0.2).
