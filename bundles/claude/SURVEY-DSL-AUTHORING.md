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

> **Contract version.** This reference tracks the Fieldbase DSL contract as of engine
> **v3.34.0**. When Fieldbase adds or tightens rules, the pack and the linter should be
> updated together (see the note at the end of §0.2).

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

### 0.1 Style — bright-line checklist (scan every edit)

These are the most common style violations across surveys. If an edit touches any of these surfaces, verify against this list **before** moving on. Each one has fired in real surveys multiple times — they are not theoretical.

| ✗ Never do | ✓ Do instead |
|---|---|
| `options: {1: Yes, 2: No}` (inline `{k:v}` form) | Multi-line options block, one code per line |
| Underscores in qids / loop ids / list names (`Q_Age`, `brand_loop`) | camelCase / `x`-between-digits: `QAge`, `brandLoop`, `Q1x1` (§1) |
| `Q.any([codes])` (no `.selected`) | `Q.selected.any([codes])` — works on **both** single and multi (#54) |
| `Q.set((Q.value or 0) + 1)` (compound expression in `.set()`) | Extract to a local, normalize `None`, then `.set(n + 1)` (#58) |
| `Q.selected.add([code])` (multi mutation via `.selected`) | Build a fresh tri-state payload + `Q.set({...})` (§12 multi) |
| Negative option codes (`-5: …`) | Renumber to positive ints; put the original delta in the label (`1: Decreased significantly (-5)`) |
| `label.prefix:` / `label.suffix:` on `single` | Bake anchors into the first/last option labels |
| `style: dropdown` on `gridSingle` | Not canonical — drop the property; the platform picks rendering |
| `style: buttons` with NPS scales: also drop `label.prefix`/`suffix` | Anchors in labels |
| Inline ternary `a if cond else b` inside `- script:` / `validation:` / `if:` predicates | Proper `if … else …` block (#56). Ternaries OK inside `{{ … }}` piping (different evaluator) |
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
| `continue` or `break` inside `for` / `while` (Python subset blocks them) | Invert the predicate and put the body inside an `if not …:`. e.g. `if c == 8: continue; rows.append(c)` → `if c != 8: rows.append(c)`, or use a `suppress = …` flag and gate the append |
| `style: image_cards` (snake_case) on `single` / `multi` | Style names are camelCase: `style: imageCards`. The snake_case form is rejected by the validator; the camelCase form is accepted by both validator and renderer (§4) |
| `exclusive: True` on a `single` option | Multi-only. `single` already enforces one-selection; an exclusive PNTA is just `anchor: True` (§3.8) |
| `label.prefix:` / `label.suffix:` on an `openList` option entry | Not valid on openList entries. Bake the prefix into the row's `label:` directly, or set affixes at question level (§3.8) |
| `left.label:` / `right.label:` on a `gridSingle` paired `scale:` entry | Belongs on row option entries, not scale entries. Each ROW carries its own left/right anchor pair (§3.8) |
| `rows: { options: listName }` (nested) on `gridNumber` | gridNumber rows/cols take inline numeric codes — `rows: { 1: Jan, 2: Feb }`. No nested `options:` shape (§2) |

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
`.selected`, `label.prefix`/`suffix` misuse, ternaries in `script:` / `validation:` /
`if:` predicates, `style: dropdown` on `gridSingle`, snake_case `style:` names,
`questions:` on a `- loop:`, multi-line `options.from:`, `continue` / `break` in
scripts, and duplicate qids / loop ids.

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
- Runtime helpers and built-ins: `fail()`, `print()`, `endSurvey()`, `quota()`, `len`, `sum`, `avg`, `random.choice`, `re.fullmatch`, `math.floor`, `datetime.now`, …
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
- Calls `endSurvey("terminate")` for screen-outs and `endSurvey("complete")` at the end of qualifying paths.
- Writes a `- note: |` `delta-log` block at the bottom flagging every assumption and every wizard handoff.

**Human programmer does (NOT the AI programmer — leave stubs and flag in delta-log):**
- **Quota cell definitions** — created via the Quota Builder UI. AI marks which questions feed quotas, inserts `endSurvey("complete")`, and (when applicable) **authors the least-fill assignment script that reads from the quota** (§16.10). AI names the required quota group in a comment directly above the script so the human knows what to build. AI does **not** generate the cell tables themselves.
- **Research module wizards** — `cbc`, `maxdiff`, `cardSort`, `textAnnotation`, `imageAnnotation`, `videoAnnotation`. Wizard-configured. AI inserts a stub `- qid:` with `type:` and `text:` only.
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

**Research-module types — do not author these in DSL:**
`cbc`, `maxdiff`, `cardSort`, `textAnnotation`, `imageAnnotation`, `videoAnnotation`. If the doc references one, leave a stub:

```yaml
- qid: ConjointTask
    type: cbc
    text: Which option would you choose?
```

Then flag in delta-log: "Configure CBC attributes/levels via the CBC wizard."

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
| `order` | most types, `loop`, `page`, `block` | `fixed` / `random` / `randomEach` / `flip` / `alphabetical` / `reverse` |
| `group.order` | types with `group` | same |
| `scale.order` | grids | same |

Semantics: `fixed` = authored order. `random` = stable random for the visible domain. `randomEach` = re-rolls per show. `flip` = deterministic split-sample (assigned once per respondent). `reverse` = forced reversed. `alphabetical` = author cautiously.

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
    if: QSegment.value == "engaged"
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

### 6.3 `- loop:` — iterate

**Loops are control-flow (repeated mixed content — questions, scripts, logic), NOT a display group.** Their body is written as **DIRECT children** with no `questions:` wrapper, exactly like `if` / `elif` / `else`. This lets `- script:` live inside a loop for per-iteration logic. The validator emits `loop-questions-not-allowed` if you use `questions:` on a loop.

```yaml
- loop:
    id: brandLoop
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
| `options:` | Inline coded list — fixed iterations. |
| `options.from:` | Python expression returning codes (most common — looping over a previous selection). |
| `group:` | Reusable list name. |
| `order:` | `fixed` / `random` / `randomEach` / `alphabetical` / `reverse` / `flip`. |

Exactly one of `options:` / `options.from:` / `group:`.

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
    - qid: QMinorScreenout
        type: info
        text: Thanks for your interest. This survey is for adults only.
    - script: |
        endSurvey("terminate")
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
    if QAge.value < 18:
        endSurvey("terminate")
    if QSpend.value > 100:
        hSegment.set("premium")
    else:
        hSegment.set("standard")
```

#### Scripts execute on traversal — placement IS timing

Scripts run when the respondent's flow traversal reaches their document position, **in document order**. There is no batch pre-pass and no implicit reordering. Where you place a script *is* when it runs.

This makes placement semantic, not stylistic. **A script must sit between its inputs and its consumers in document order, so that by the time traversal reaches a consumer, the script has already populated the state the consumer reads.**

| Script kind | Place it... |
|---|---|
| **Punches a hidden question** from previous selections (or any source) | **Immediately BEFORE the hidden question's definition.** Define the hidden destination right after its punch — the script writes, the destination follows, and the pair is co-located. |
| **Derives a value from a recently-answered question** (`hRaceRecode` from `Race`, `hSegment` from `QAge` × `QSpend`) | **Between the source and the destination** — after every source question, before the destination hidden helper. |
| **Defines a masking helper** used by `options.from:` / `scale.from:` / `if:` | **Immediately BEFORE the consuming question.** The helper must be `def`'d before traversal hits the consumer's `options.from:`. |
| **Routes the flow** (`endSurvey("terminate")`, `endSurvey("complete")`, a branch flag the next `- if:` reads) | **At the routing point** — the document position where the route is taken. |
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
    if: len(habit_screen_rows_qualifying()) > 0
    options.from: habit_screen_rows_qualifying()
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
    # that reads hSegment.value sees null.
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

Always used at the **bottom of every authored `.yml` file** for the delta-log (§19).

---

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

- if SZip.matched == False:
    - script: |
        endSurvey("terminate")
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
    columns:
        - qid: QBrandFamiliarity
            type: single
            text: How familiar are you with {{ row.label }}?
            options: agreementScale
        - qid: QBrandRecommend
            type: number
            text: Likelihood to recommend (0–10)
            min: 0
            max: 10
```

Rules:
- Shared rows come **only** from the parent `options:` / `options.from:` / `group:`. Do not re-author `options`/`group` on nested column qids.
- Children allowed: `single`, `multi`, `rank`, `openList`, `numberList`, `gridSingle`. Plain `open`, plain `number`, and `gridMulti` are **rejected**.
- `columns:` must contain at least one child.

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
| `{{ "%.2f" % QSpend.value }}` | Format spec |
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

`{{ total }}` references the local Python variable computed inside the `validation:` block. Anything in scope when the helper runs — locals, hidden question values, `Q.*` accessors — is available inside `{{ }}`.

### Auto-escaping in HTML contexts

Piped values are HTML-escaped automatically. A respondent who typed `<script>alert(1)</script>` into `QName` produces literal text in the rendered output, not an executed tag. You can pipe any answer (including free `open` text) into HTML contexts without writing your own escaping.

---

## 10. The Python subset

Used in `validation: |`, `if:`, `script: |`, `options.from:`, `scale.from:`, and inside `{{ }}` pipes.

**Comments are Python-inert everywhere.** `#` line comments and `#[[ … #]]` block comments are stripped by the parser before compilation, ignored by the validator's `{{ }}` piping check, and never block publish. This holds for:

- Full-line `# comment` in scripts, validation, options.from
- Inline trailing `# comment` on `- if …:` / `- elif …:` / `- else:` flow headers (e.g., `- if Q.answered:  # only if answered`)
- Inline trailing `# comment` on code lines inside `- script:` / `validation:`
- `#` inside `{{ }}` display pipes — inert even if it looks like Python

A `{{ Q.value }}` written INSIDE a `# comment` line is inert to the display-pipe validator (never fires unknown-object / empty-pipe). So write comments freely — they never break the survey.

### 10.1 Control flow — supported

`if` / `elif` / `else` (statement form, in scripts and validation), `for`, `while`, `def`, `try` / `except` / `finally`.

**Inline conditional expression (`a if cond else b`) — piping only.** The ternary form is allowed inside `{{ ... }}` text piping (per `the bundled piping examples`) but **NOT** inside `- script:` / `validation:` / `if:` predicates. In script context, use a proper `if / else` block:

```python
# ❌ Not allowed in scripts
hQ7.set(1 if boxedEaten else 2)

# ✅ Proper if / else
if boxedEaten:
    hQ7.set(1)
else:
    hQ7.set(2)

# ✅ Inside piping — ternary IS allowed
text: |
    Hi {{ "there" if not QName.answered else QName.value }}, welcome back.
```

```python
# if/elif/else
if QAge.value < 18:
    hAgeBand.set(1)
elif QAge.value < 35:
    hAgeBand.set(2)
else:
    hAgeBand.set(3)

# for with tuple unpacking
for index, code in enumerate(QBrand.selected):
    print(index, code)

# def with defaults / *args / **kwargs
def is_premium():
    return QSpend.value > 100

# try/except/finally
try:
    QRank.set(rank_codes)
except Exception:
    QRank.set([1, 2, 3])
```

`def`'d functions defined in one `- script:` are callable from every subsequent `- script:` and from inline `- if <expr>:` predicates.

### 10.2 Control flow — blocked

| Construct | Use instead |
|---|---|
| List/dict/set comprehensions | Explicit `for` loop with `result.append(...)` |
| Generator expressions | Explicit `for` loop |
| `lambda` | Top-level `def` |
| Decorators (`@something`) | Call the wrapper explicitly |
| `class` definitions | Use a dict or top-level functions |
| `with` statements | Runtime has no resources to manage |
| `async` / `await` / `yield` | Synchronous logic only |
| `break` / `continue` | Restructure with a flag or early `return` |
| `//` floor division | `int(a / b)` or `math.floor(a / b)` |
| f-strings (`f"..."`) | `"..." + str(x)` or `"%s" % x` (or use `{{ }}` in pipe-aware text) |
| Walrus `:=` | Plain assignment then condition |
| `import` (any) | The four safe modules below are pre-imported |
| File I/O / network | Sandboxed runtime |
| `switch` | `if`/`elif`/`else` |
| `s.replace(...)` | `re.sub(pattern, repl, s)` |
| `s.split()` (no-arg or multi-arg) | `s.split(",")` requires exactly one separator; for advanced use `re.split()` |

### 10.3 Operators — supported

Comparison `==` `!=` `<` `<=` `>` `>=`, boolean `and` `or` `not`, membership `in` `not in`, identity `is` `is not`, arithmetic `+` `-` `*` `/` `%` `**`, unary minus, indexing `x[0]` `x[-1]` `x[1:3]`, parentheses.

`/` is true division (always a float when both sides are int). For floor-division use `int(a / b)` or `math.floor(a / b)`.

### 10.4 Built-ins — pre-imported, no `import` needed

```python
# Aggregate
len(x)              # length of sequence / collection
min(x)              # minimum
max(x)              # maximum
sum(x)              # sum
avg(x)              # mean (platform addition)
sorted(x)           # new sorted list (key=, reverse= supported)
range(start, end)   # iterable range — INCLUSIVE on both ends (different from Python)
enumerate(x)        # (index, value) pairs
zip(a, b)           # parallel iteration
any(x)              # True if any truthy
all(x)              # True if all truthy

# Constructors
set([1, 2, 3])
list(x)
dict(...)
tuple(x)

# Type conversion
str(x)              # to string
int(x)              # to int — strict, throws on bad input
float(x)            # to float — strict, throws on bad input
bool(x)             # Python-like truthiness
isNumeric(x)        # platform: True if x parses as a number
toNumeric(x)        # platform: coerce to number
toInt(x)            # platform: coerce to int (strict)
toString(x)         # platform: alias for str
parseInt(x)         # platform: parse string as int (strict)
parseFloat(x)       # platform: parse string as float (strict)

# Math
abs(x)
round(x)            # half-away-from-zero
round(x, n)
```

### 10.5 Safe modules — pre-imported

```python
math.floor(x)
math.ceil(x)
math.sqrt(x)
math.pi
math.e

random.choice([1, 2, 3])
random.shuffle(my_list)         # in place
random.randint(0, 10)           # int in [0, 10] inclusive

re.match(pattern, text)
re.search(pattern, text)
re.fullmatch(pattern, text)     # anchored both ends — use this for validation regex
re.sub(pattern, replacement, text)
re.split(pattern, text)
re.findall(pattern, text)
re.escape(s)

datetime.datetime.now()
datetime.date.today()
datetime.timedelta(days=7)
```

`random` produces respondent-specific results that won't reproduce on replay — gate treatment assignments behind a hidden flag so the same respondent doesn't re-randomise on navigation.

`re.fullmatch` (not `re.match`) is the right choice for validation regex — it anchors both ends.

### 10.6 String methods — supported

`.strip()`, `.lower()`, `.upper()`, `.startswith(s)`, `.endswith(s)`, `.split(sep)` (one separator argument required), `s in s2`, `len(s)`. Slice/index supported.

Blocked: `.replace(...)` → use `re.sub(pattern, repl, s)`.

### 10.7 Runtime helpers

| Helper | Usage |
|---|---|
| `fail(message)` | Inside `validation:` — reject the answer with a custom message. **Single argument.** Pipe-aware via `{{ }}`. |
| `print(message)` | Inside `- script:` — diagnostic output. Pipe-aware. |
| `endSurvey(outcome)` | Inside `- script:` — terminate with `"complete"` / `"terminate"` / custom outcome. |
| `quota("groupId", cellCode)` | Read a quota cell's current state. Rare in author code; quota cells are configured by the human in the Quota Builder. |
| `q(baseName)` / `q(baseName, code)` | Dynamic qid lookup — returns the question proxy for `baseName` or `baseName + code` (see §10.8). Returns `null` if no proxy is registered under that name. |
| `request.url` | Current URL string. |
| `request.param("key")` | Query-string parameter value. **Returns `""` for missing keys, never `None`.** |

### 10.8 `q()` — dynamic qid lookup

`q(baseName)` returns the runtime proxy for the question with that qid. `q(baseName, code)` **concatenates `code` onto `baseName` (no separator inserted)** and looks up the combined name. Both return `null` if no question is registered under the resulting name.

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
# Unanswered numeric → coalesce to 0
total = (QAge.value or 0) + (QPartnerAge.value or 0)

# Early exit when an upstream answer is missing
if not QSpend.answered:
    hSpendBand.set(0)
    return  # only valid inside def
# ... arithmetic that assumes QSpend has a value ...

# Empty-string check on request params (don't compare against None)
if request.param("source") == "":
    hSourceMissing.set(1)
# Or shorter:
if not request.param("source"):
    hSourceMissing.set(1)

# Safe numeric validation — guard before strict conversion
if QAge.value.strip() != "" and not isNumeric(QAge.value):
    fail("Enter a valid number.")
elif isNumeric(QAge.value) and toNumeric(QAge.value) < 18:
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
| `cbc` (research module) | `task(T)` — returns the task proxy for task index T (1-based) | (author uploads attributes/levels via CBC wizard) |
| CBC task proxy (`QCbc.task(T)`) | `.ratings(N)` — rating captured for concept in column N (1-based). `.rank(N)` — rank position captured for concept in column N (1-based). `.chosen` — chosen concept column (1-based). | (none) |

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
- **Lookup `.matched` vs `.answered`:** `matchOnly` lookups have `.answered = True` after any text — always check `.matched` for screenouts.
- **Cross-iteration access uses `Qx_` (trailing underscore) accessor, not bare brackets.** Static: `QRating_1.value`. Dynamic: `QRating_[c].value`. Nested: `QRating_[b][a].value`. The dynamic-name form `q("baseName", code)` resolves a qid by string. Without these, references inside a loop body resolve to the current iteration; outside the loop, you must qualify with one of these forms.

### Absence semantics

| Accessor kind | When unanswered |
|---|---|
| coded scalar (`single.value`, `gridSingle.row(n).value`) | `null` |
| numeric (`number.value`) | `null` |
| text (`open.value`) | `""` |
| collection (`multi.selected`, `rank.values`) | empty collection |
| missing rank slot | `null` |
| `request.param(...)` missing key | `""` (never `None`) |

### Collection / Set ops

Returned by `.selected`, `.all`, `.values`, `.allLabels`, `.selectedLabels`, `.records`.

Properties: `.size`, `.labels`.
Methods: `.at(n)`, `.any([codes])`, `.every([codes])`, `.intersect([codes])`, `.union([codes])`, `.minus([codes])`. `.add` / `.remove` exist on set objects, not directly on `.selected`.

Membership: `code in Q.selected`, `code not in Q.all`. Build a fresh set with `set([1, 2, 3])`.

**Deprecated — never use:** `.contains(...)`, `.has_any(...)`, `.has_all(...)`, `.iter`, `.iteration`, `.labels` on a question (use `selectedLabel`/`selectedLabels`/`allLabels`).

### Fluent vs write-terminal mutation methods

DSL mutation methods split into two categories. The split matters: mixing them up silently produces a `None` variable that crashes on the next use, and the validator now fires diagnostics for the wrong form.

#### Fluent methods — return `self` or a new object (safe to chain / assign)

| Receiver | Fluent methods |
|---|---|
| `collection` (`Q.all`, `Q.selected`, `Q.values`, `Q.allLabels`, `Q.selectedLabels`, `Q.records`) | `.add(codes)`, `.remove(codes)`, `.intersect(codes)`, `.union(codes)`, `.minus(codes)` |
| `setobj` — a constructed `set([...])` | `.add(codes)`, `.remove(codes)`, `.discard(codes)`, `.clear()` |
| `list` | `.append(x)`, `.extend(iterable)`, `.remove(x)`, `.sort()`, `.clear()` |
| `dict` | `.set(key, value)` |

Because these return `self` or a new collection, **chaining and result capture are both valid**:

```python
s = S2.all.remove(3).add(5)        # ✓ fluent chain — s is the modified set
filtered = items.remove(99)        # ✓ result is the modified collection
return set(currently_used()).add([97, 98])   # ✓ canonical multi-add idiom (§11 above)
```

#### Write-terminal methods — always return `None` (never chain or capture)

| Receiver | Write-terminal methods |
|---|---|
| Any question proxy — bare qid (`Q1`), `q(...)`, row accessor (`Q.row(c)`) | `.set(payload)`, `.reset()` |
| `quota(group, code)` | `.fill()` (manual single-cell fill — see §15) |

These mutate state and discard the return value:

```python
Q1.set(2)                          # ✓ correct — on its own line
Q1.reset()                         # ✓ correct
quota("qtgender", 1).fill()        # ✓ correct

x = Q1.set(2)                      # ✗ wrong — x is None, validator fires
y = Q1.reset()                     # ✗ wrong — y is None
z = quota("c", 1).fill()           # ✗ wrong — z is None
chain = Q1.set(2).reset()          # ✗ wrong — chain fails on the second call
```

**Why the same name `.set()` is fluent on dict and write-terminal on a question:** receiver matters. `someDict.set("k", "v")` returns the dict (fluent — capture if you want). `Q1.set(2)` returns `None` (write-terminal — don't capture). The validator is receiver-aware and tells them apart by knowing the qid registry.

#### Validator diagnostics

| Diagnostic code | Fires when |
|---|---|
| `question-write-assign` | The result of `.set()` / `.reset()` on a known qid (or `q(...)` proxy, or `Q.row(c)` accessor) is assigned to a variable. Also fires for `.fill()` on a `quota(...)` call. |
| `none-returning-method-assign` | A method known to return `None` regardless of receiver is assigned. Currently empty — the receiver-aware check above handles all known write-terminal cases. |

**False positives explicitly avoided** — the validator does NOT fire on:

- `s = someDict.set(k, v)` — receiver is not a known qid
- `s = S2.all.remove(3)` — `.remove()` on a collection is fluent, not write-terminal
- `out = set([1, 2]).add([3, 4])` — `.add()` on a set object is fluent

#### Quick decision rule

If the receiver is a **question proxy** or **`quota(...)` call** → method mutates state, returns `None`, call on its own line.
If the receiver is a **collection / set / list / dict** → method is fluent, returns the result, capture or chain freely.

### Authoring style — prefer accessors over raw iteration

The runtime gives you collection accessors and built-ins for the shapes that come up over and over. Reach for them first; write a `for` loop only when the accessor surface genuinely doesn't cover the case. The accessor form is shorter, faster to read, faster to execute, and less likely to drift when the underlying domain changes.

```python
# ❌ Verbose — manual iterate-and-accumulate.
t = 0
for c in Device.all:
    t = t + (Device.row(c).value or 0)
if t != 100:
    fail(QErrMsg.row(6).label)

# ✅ Idiomatic — sum() over the .values accessor.
if sum(Device.values) != 100:
    fail(QErrMsg.row(6).label)
```

A few patterns worth knowing:

| Goal | Accessor form |
|---|---|
| Sum a `numberList`'s row values | `sum(Q.values)` |
| Average a `numberList`'s row values | `avg(Q.values)` |
| Count selections on a `multi` | `Q.selected.size` |
| Membership test (single or multi) | `Q.selected.any([codes])` — **always go through `.selected`**, even on `single` questions. `.any(code)` is a shorthand for one code. `code in Q.selected` reads naturally for one code too. `Q.value == N` still works on `single` for a single code; for two-or-more codes, prefer `Q.selected.any([N1, N2])` over a chain of `or`s — easier to extend, easier to read. **There is no `Q.any(...)` form** — `.selected` is required, mirrors are not valid. |
| All of these codes selected? | `Q.selected.every([codes])` |
| Set difference | `Q.selected.minus([codes])` |
| Set union (add multiple codes at once) | `Q.selected.add([codes])` / `set([...]).add([codes])` |
| Get a row's value defensively | `Q.row(code).value or 0` (None → 0) |
| Check answered before reading | `Q.answered` (don't compare value to None) |

**Multi-add idiom.** When you'd otherwise call `.append(x)` two or more times in a row to extend a code list, use the set object's `.add([codes])` method to add them in one shot. Personal style varies — appending is fine for a single code — but for more than one code, batching reads cleaner and signals intent:

```python
# ❌ Two appends in a row
result = currently_used_svods()
result.append(97)
result.append(98)
return result

# ✅ Single .add over a set
return set(currently_used_svods()).add([97, 98])
```

**Prefer `range(a, b)` over enumerated code lists when the codes are contiguous.** Spelling out `[1, 2, 3, 4, 5, 6, 7]` is verbose and fragile — a programmer can quietly skip or repeat a code and corrupt the survey path. `range(1, 7)` (inclusive both ends in this DSL) is unambiguous and survives renumbering.

```python
# ❌ Enumerated — easy to miscopy "5" twice or skip "4"
if Q1.selected.any([1, 2, 3, 4, 5, 6, 7]):
    ...
for code in [1, 2, 3, 4, 5, 6, 7]:
    inputs.append(Q1.row(code).value)

# ✅ range() — single source of truth for the bound
if Q1.selected.any(range(1, 7)):
    ...
for code in range(1, 7):
    inputs.append(Q1.row(code).value)
```

Use enumerated lists only when the codes are **non-contiguous** (e.g. `[1, 2, 3, 4, 5, 6, 97]` where 97 is the "None of the above" anchor).

**Extract a helper function when a boolean expression spans more than two rows / accessors.** A chain of `Q.row(1).selected.any([3]) or Q.row(2).selected.any([3]) or Q.row(3)...` is hard to read, hard to maintain, and hard to spot a missing row in. Loop instead:

```python
# ❌ Long disjunction — fragile and unreadable
if Q6.row(1).selected.any([3]) or Q6.row(2).selected.any([3]) or Q6.row(3).selected.any([3]) or Q6.row(4).selected.any([3]) or Q6.row(5).selected.any([3]) or Q6.row(6).selected.any([3]) or Q6.row(7).selected.any([3]):
    ...

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
    ...

# Idiomatic
if (Platform.row(2).value or 0) > 0:
    ...
```

---

## 12. `.set(...)` and other write-terminal mutators on question proxies

**`.set(...)`, `.reset()` on any question proxy, and `.fill()` on `quota(...)`, always return `None`.** They are **write-terminal** — they mutate state and discard the return value. The full fluent-vs-write-terminal taxonomy lives in §11; this section is the per-type payload contract.

```python
Q1.set(2)            # ✓ correct — call on its own line
Q1.reset()           # ✓ correct
x = Q1.set(2)        # ✗ wrong — x is None, validator fires `question-write-assign`
```

**Multi-call write idiom** — when you have several writes to do, each on its own line, never chained:

```python
hSegment.set(7)
hAvgRating.set(total / count)
hBestBrand.set(bestCode)
```

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

`.reset()` clears everything. For cascading lookup, `.reset(stepId)` clears that step and all later steps. Both `.set` and `.reset` are write-terminal.

**Strict rules:** wrong payload shape throws; unknown codes throw; partial mutation not allowed (invalid payload leaves prior value unchanged).

**Don't confuse with fluent `.set` on dicts.** A Python dict's `.set(key, value)` is fluent (returns the dict, safe to capture). The validator distinguishes by receiver — only `.set()` on a known qid / `q(...)` proxy is write-terminal.

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

> **Quota cell definitions are created by the human programmer in the Quota Builder.** AI does not generate cell tables. But AI **does** author scripts that *read* from quota cells (least-fill assignment, conditional gates, monitoring) and routes the complete fill via `endSurvey("complete")`.

### 15.1 The runtime quota accessor

`quota("groupId", cellCode)` returns a quota-cell proxy.

**Read accessors** (return a value):

| Accessor | Returns | Meaning |
|---|---|---|
| `.isOpen` | `bool` | `True` when the cell still has fill remaining; `False` when at target |
| `.count` | `int` | Current fills against this cell |
| `.target` | `int` | The cell's target (0 = uncapped monitor) |
| `.remaining` | `int` | `target - count`, clamped at 0 |

**Write method** (write-terminal — returns `None`, never chain or capture):

| Method | Behaviour |
|---|---|
| `.fill()` | Manual single-cell fill. Increments the cell's count by one, atomically. Used for script-driven fills outside the standard `endSurvey("complete")` path (e.g. quota borrowing, manual adjustments). |

```python
# ✓ Correct — call on its own line.
quota("qtGenderAge", 4).fill()

# ✗ Wrong — .fill() returns None, validator fires `question-write-assign`.
result = quota("qtGenderAge", 4).fill()
```

`.fill()` is **distinct from `endSurvey("complete")`** — the latter is the standard auto-fill path that evaluates all matching cells atomically for a respondent's full set of answers. `.fill()` is for one-off, manually-driven cell increments and rarely needed in everyday survey authoring. When in doubt, route the complete through `endSurvey("complete")` and let the engine handle the cells.

Group ids are author-chosen names that match what the human will configure in the Quota Builder. Use a stable convention (e.g. `qt<thing>`) and **document the required group + cell codes in a comment directly above the script**.

### 15.2 What the AI programmer authors

1. Make sure questions that feed quota dimensions exist with clean numeric codes (typically demos: `Gender`, `AgeBand`, `Region`).
2. Author least-fill / priority-fill **assignment scripts** that read open cells from a named quota and punch a hidden helper question (§16.10). Place a `# Prerequisite:` comment above the script naming the required quota group.
3. Place `endSurvey("complete")` at the end of each qualifying path so the engine evaluates and increments cells:
   ```yaml
   - script: |
       # Mark the qualified respondent as a complete — triggers quota cell increment.
       endSurvey("complete")
   ```
4. In the delta-log, list every quota group the survey expects, with the cell codes and (where known) the targets, so the human can build them in the Builder.

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
        endSurvey("terminate")
```

### 16.2 ZIP screener with `matchOnly`

```yaml
- qid: SZip
    type: lookup
    source: http://localhost:3001/lookup/target_zips
    source.value: zipcode
    source.display: zipcode
    source.matchOnly: True
    text: Enter your ZIP code

- if SZip.matched == False:
    - script: |
        endSurvey("terminate")
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
    options.from: QBrandsAware.selected
    questions:
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
        if (QLiving.selected.any(1) and QLiving.selected.size > 1) \
                or (QLiving.selected.any(7) and QLiving.selected.any([5, 6])):
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
    if QAge.value < 25 and QSpend.value > 100:
        hSegment.set("young_premium")
    elif QSpend.value > 200:
        hSegment.set("high_value")
    else:
        hSegment.set("standard")

- qid: QPriorityFollowup
    type: single
    text: Based on what you've told us, are these priorities right?
    if: hSegment.value == "young_premium"
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
    questions:
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

**`math.exp` isn't in the Python subset** (§10.5). Use `math.e ** score` instead — `math.e` is supported and `**` is the standard exponentiation operator.

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
    options.from: Q1.selected.minus([8, 9])
    questions:
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
    s5 = min(Q5.values) == max(Q5.values)
    s7 = min(Q7.values) == max(Q7.values)
    hQ5Straight.set(1 if s5 else 2)
    hQ7Straight.set(1 if s7 else 2)
    if s5 and s7:
        endSurvey()
```

**Edge to watch:** `min` / `max` over a vector with `None` values may error or return `None`. Safe on `required: True` grids (every row filled). On optional grids, build a filtered list first:

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
12. ❌ `.replace(...)` — use `re.sub(...)`. `//` — use `math.floor(...)`. `switch` — use `if/elif/else`. List comprehensions — use explicit `for`.
13. ❌ `import math` (or any import) — modules are pre-imported; just call them.
14. ❌ `f"..."` strings, walrus `:=`, lambdas, decorators, classes — all blocked.
15. ❌ `break` / `continue` — restructure with a flag or early `return`.
16. ❌ Using `.answered` to gate a screenout on a `matchOnly` lookup — use `.matched`.
17. ❌ Forward references in scripts (helper used before definition).
18. ❌ `total: True` to mean "validate the sum" — `total:` only controls *display*; use `sum:` and/or `validation:`.
19. ❌ Reading a respondent answer before its question is shown. Setting forward (`Q.set(...)`) for prefill is fine.
20. ❌ Multi-select on cascading lookup or with `source.matchOnly: True` — both reject `multi: True`.
21. ❌ Authoring `cbc` / `maxdiff` / `cardSort` / annotation modules in DSL — leave a stub and flag.
22. ❌ Authoring quota cells in DSL — human-task.
23. ❌ Stopping mid-document to ask a clarifying question — code best-effort and put it in the delta-log.
24. ❌ Comparing `request.param("...")` to `None` — it returns `""` for missing keys.
25. ❌ Inventing qid prefixes when the qnr already uses an alphanumeric name. `Gender` stays `Gender`, never `SGender` / `QGender`. Prefix only when the qnr labels with pure numbers (`1`, `2`, ...).
26. ❌ Wrapping a single standalone question in `- page:`. Pages exist to group two-or-more questions on one screen; a lone question is its own one-screen unit at the top level.
27. ❌ Inline string literals inside `fail(...)`. House standard: every `fail()` pulls from `QErrMsg.row(N).label` (§5.6). Translation, copy review, and consistency all depend on this.
28. ❌ Bundling every helper script at the top of the file. **Co-locate** each script with the question it serves (§6.5). Derived-value punches go right after the source question; masking helpers go right above their consumer.
29. ❌ A masked question with no skip-if-empty guard. When `options.from:` returns empty, a required question becomes a dead-end. Always pair with `if: len(helper()) > 0`.
30. ❌ A `- script: |` block with no `#` comment. Every script needs at least one short comment naming what it does — the next reader's first lookup.
31. ❌ Hand-rolling iteration when an accessor exists. `sum(Q.values)` over `for c in Q.all: t += Q.row(c).value`. `Q.selected.size` over manually counting. `code in Q.selected` over `Q.selected.any([code])` for a single code. (§11 "Authoring style".)
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
52. ❌ Capturing the return value of a **write-terminal** mutator. `Q1.set(...)`, `Q1.reset()`, `Q1.row(c).set(...)`, `q("Q1").set(...)`, and `quota(group, code).fill()` always return `None` (§11 / §12). Assigning the result (`x = Q1.set(2)`) makes `x` None and the validator fires `question-write-assign`. Call write-terminal mutators on their own line. Distinguish from **fluent** collection / set / list / dict mutators (`.add`, `.remove`, `.intersect`, `.union`, `.minus`, `.append`, `.extend`, `.sort`, `.clear`, dict `.set(k, v)`) which DO return the modified object and are safe to chain or capture.
53. ❌ Chaining `.set()` on a question proxy. `Q1.set(2).reset()` won't work — the first call returns `None`, so the second call errors. Use separate lines for each write. Chaining is only valid on fluent receivers (collections / sets / lists / dicts).
54. ❌ Dropping `.selected` from a membership test. The accessor is `Q.selected.any([codes])` on **both single and multi** — there is no `Q.any(...)` form. Per `the bundled single-type example` line 145–146: `Q.selected.any(N)` and `Q.selected.any([1, 2])` are the canonical reads. On `single`, `Q.value == N` is also valid for one code, but for two-or-more codes prefer `Q.selected.any([N1, N2])` over a chain of `or`s (easier to extend, easier to scan). Worked example: `QH.selected.any([1, 2])` ✓ — not `QH.any([1, 2])`. **Cross-check chat shorthand against this authoring reference / the bundled examples before applying** — chat examples are easy to misread, the doc is the source of truth.
55. ❌ Forgetting that lists (`- lists: foo:`) are static authoring constructs, not runtime objects. `.all` works on **questions and loops**, not on shared lists. To enumerate codes a list defines, iterate from a question that uses the list (`for code in Q7.all:` not `for code in proteinList.all:`). Bonus: `Q.all` honors `options.from` masking — it reflects what the respondent saw, not the static authoring list.
56. ❌ Inline ternary (`a if cond else b`) inside `- script:` / `validation:` / `if:`. The script Python subset has no conditional expression — use a proper `if / else` block (§10.1). Worked example: `hQ7.set(1 if boxedEaten else 2)` ❌ → `if boxedEaten: hQ7.set(1) else: hQ7.set(2)` ✓. Ternaries ARE allowed inside `{{ ... }}` text piping (different evaluator).
57. ❌ Inventing an `h` / `H` / `HQ` prefix when the qnr already names a hidden question. Analysts look for hidden helpers by the qnr name — if the doc says "Q9" for the protein assignment or "Q10F" for the hidden rank, use `Q9` / `Q10F`, not `HQProtein` / `HQ10FRank`. The `h`-prefix soft convention applies **only** to hidden helpers AI introduces beyond the qnr (`hCountry`, `hSegment`, `hTrapCount`, etc.).
58. ❌ Compound expressions inside `Q.set(...)` for a `number` question. `HQTrapCount.set((HQTrapCount.value or 0) + 1)` is unreliable — `.set()` wants a plain value (number / code / list), not an arithmetic chain wrapping a defensive `or` against `None`. Compute first into a variable, then pass the variable:

    ```python
    # ❌ Inline arithmetic on the .set() argument
    HQTrapCount.set((HQTrapCount.value or 0) + 1)

    # ✅ Resolve None defensively, then write a clean value
    n = HQTrapCount.value
    if n is None:
        n = 0
    HQTrapCount.set(n + 1)
    ```

    Same rule for any accumulator pattern: extract the read, normalize None, increment, write.
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
   - CBC / MaxDiff / CardSort / annotation → stub only (human task)

4. **Code numerically.** Apply the list-extraction protocol (§18). Mark anchors / exclusives / specifies / DK-NA boilerplate. Default code conventions: `97` Other (specify), `98` Don't know, `99` None of these / Prefer not to say (with `anchor: True` and on `multi` typically `exclusive: True`).

5. **Author logic.** `if:` for show conditions, `validation: |` blocks (use the error-message bank pattern when messages recur), `script:` for derived flags and segment assignment, `endSurvey("terminate")` for screenouts, `endSurvey("complete")` at the end of qualifying paths.

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
    - CBC: ConjointTask — configure 4 attributes (price, brand, speed, support) via CBC wizard.
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
