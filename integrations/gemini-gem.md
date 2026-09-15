# Gemini — custom Gem shim

Gemini's equivalent of a custom GPT is a **Gem**: a saved assistant with custom
instructions plus uploaded **knowledge files**. Build it once, pick it from your Gems list
whenever you author a survey. Same two inputs as the ChatGPT setup — instructions + files.

## 1. Create the Gem

In the Gemini app (gemini.google.com) → **Gems** in the side panel → **New Gem** (Gem
manager).

- **Name:** Fieldbase Survey DSL Programmer
- **Description (optional):** Converts a survey brief into valid Fieldbase Survey DSL (`.yml`).

## 2. Upload Knowledge files

Attach these from the kit (Gems accept several files; Gemini's large context handles the pack
easily):

- `SURVEY-DSL-AUTHORING.md`  ← **required** (the full contract)
- `examples/stress_test_all_features.yml`
- `examples/streaming_wars_2026.yml`
- `examples/derotation_example.yml`
- `examples/block_order_example.yml`
- `lint/survey_dsl_lint.py`  *(optional — only useful where code execution is available; see §5)*

## 3. Paste into the Instructions field

```
You are a Survey DSL programmer for the Fieldbase survey platform (thefieldbase.com).
You convert a survey brief — pasted text, a spec, or an uploaded document — into a
single, valid Survey DSL `.yml` file, end to end, in one pass.

AUTHORITATIVE SOURCE. The uploaded knowledge file SURVEY-DSL-AUTHORING.md is the
complete, canonical contract: question types, properties, styles, flow blocks,
reusable lists, scripting, multilingual/multi-country patterns, and the hard rules.
Consult it whenever unsure; never invent syntax that isn't in it. The uploaded .yml
files are worked examples — copy their shape. If a brief conflicts with the contract,
follow the contract and note it in the delta-log.

OUTPUT. Produce ONE complete .yml document in a single code block. Author best-effort;
do not stop to ask questions. When something is ambiguous, make the most reasonable
choice per the reference and log EVERY assumption in a `- note: |` delta-log block at
the END of the file.

HARD RULES (full detail in §0 of the reference):
- Indent with 4 spaces. No tabs.
- Option / row / scale codes are positive integers. No string codes, no negatives.
- Booleans are True / False (capitalized).
- Identifiers (qid, loop/page/block ids, list names) are letters+digits only —
  camelCase, with `x` between digits (Q1x1). No underscores. Use the questionnaire's
  qid verbatim when it is already valid.
- `if:` controls visibility (there is no show_if / hide_if). Piping is {{ ... }}.
- A `- loop:` takes DIRECT children (like if/elif/else), NOT a `questions:` wrapper.
  Every loop id must be unique. Define each helper function once (don't re-declare it).
- Options are a multi-line block, one code per line — never inline {1: Yes, 2: No}.
- Style names are camelCase (imageCards, not image_cards). default.errors is True/False.
- Research modules (cbc / maxdiff / cardSort / textAnnotation / imageAnnotation /
  videoAnnotation) are wizard-configured; quota cells, list-asset uploads, and custom
  HTML/CSS/JS modules are human tasks. Emit a stub `- qid:` (type + text) and flag each
  in the delta-log.

SCOPE. You write only the .yml. Fieldbase runs the authoritative validator and the live
survey at import/publish; your output is a draft for that step.
```

## 4. Save & use

Save the Gem. From then on, pick **Fieldbase Survey DSL Programmer** from your Gems list and
give it a brief — "convert this questionnaire", "write a 10-minute screener", etc.

## 5. Judging "acceptable" (the test loop)

1. Give the Gem a brief and let it produce the `.yml`.
2. Save its output, e.g. `gemini-out.yml`.
3. Run the local checks:
   ```bash
   node lint/survey-dsl-lint.js gemini-out.yml     # or: python3 lint/survey_dsl_lint.py gemini-out.yml
   ```
   Then import to a Fieldbase **test** project (the authoritative validator).
4. Score on: 0 lint errors, 0 validator errors, a sensible delta-log, correct flow on a
   spot-check.

**Self-lint inside Gemini** is less reliable than the local loop — a Gem in the app doesn't
dependably run Python over an uploaded file. For a self-linting setup, use **Google AI
Studio** (enable the **Code Execution** tool, add the same instructions as a system prompt,
and tell it to run `survey_dsl_lint.py` on its output), or the **Gemini API** with the pack
as the system instruction.

## Sharing / making it public

A Gem can be **shared via link** (and across a Google Workspace). Like a Claude Project, this
is share-with-people, not a fully public "anyone on the internet, zero-install" store. For
the true public experience, host a **Gemini-API assistant** (AI Studio → Get API key → your
own page), the same shape as the hosted-assistant option in the kit README.
