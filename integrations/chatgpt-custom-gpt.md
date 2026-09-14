# ChatGPT — Custom GPT shim

Set up a "Survey DSL Programmer" GPT that authors Fieldbase surveys from this kit.
A custom GPT has two inputs: a short **Instructions** field and **Knowledge** file
uploads. The big authoring reference goes in Knowledge; the Instructions point at it.

## 1. Create the GPT

ChatGPT → **Explore GPTs → Create → Configure**.

- **Name:** Fieldbase Survey DSL Programmer
- **Description:** Converts a survey brief into valid Fieldbase Survey DSL (`.yml`), in one pass.

## 2. Upload Knowledge files

Upload these from the kit (a GPT allows up to 20 files):

- `SURVEY-DSL-AUTHORING.md`  ← **required** (the full contract)
- `examples/stress_test_all_features.yml`
- `examples/streaming_wars_2026.yml`
- `examples/derotation_example.yml`
- `examples/block_order_example.yml`
- `lint/survey-dsl-lint.js`  *(optional — lets it see exactly what the linter checks)*
- `lint/survey_dsl_lint.py`  *(optional — the Python port; upload this if you want the GPT to self-lint via Code Interpreter, see the last section)*

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

OUTPUT. Produce ONE complete .yml document in a single code block. Author the whole
thing best-effort; do not stop to ask questions. When something is ambiguous, make the
most reasonable choice per the reference and log EVERY assumption in a `- note: |`
delta-log block at the END of the file. That delta-log is your handoff to the human.

HARD RULES (never violate — full detail in §0 of the reference):
- Indent with 4 spaces. No tabs, no 2-space.
- Option / row / scale codes are positive integers. No string codes, no negatives.
- Booleans are True / False (capitalized).
- Identifiers (qid, loop/page/block ids, list names) are letters+digits only —
  camelCase, with `x` between digits (Q1x1). No underscores. Use the questionnaire's
  qid verbatim when it is already valid.
- `if:` controls visibility (there is no show_if / hide_if). Piping is `{{ ... }}`.
- A `- loop:` takes DIRECT children (like if/elif/else), NOT a `questions:` wrapper.
  Every loop `id:` must be unique.
- Options are a multi-line block, one code per line — never inline `{1: Yes, 2: No}`.
- Style names are camelCase (imageCards, not image_cards). `default.errors` is
  True/False only.
- Research modules (cbc / maxdiff / cardSort / textAnnotation / imageAnnotation /
  videoAnnotation) are wizard-configured: emit a stub `- qid:` with type + text only
  and flag it in the delta-log. Quota cells, list-asset uploads, and custom HTML/CSS/JS
  modules are human tasks — leave stubs and flag them too.

SCOPE. You write only the .yml. The Fieldbase platform runs the authoritative validator
and the live survey at import/publish — your output is a draft for that step. A
companion linter (survey-dsl-lint.js) is run locally by the human to catch mechanical
mistakes; write as if it will run. You cannot run it yourself unless Code Interpreter is
enabled with a linter available.
```

## 4. Conversation starters

- Convert this questionnaire into Fieldbase DSL: (paste it)
- Write a 5-minute screener: age, gender, region, category usage, with a screen-out.
- Add a loop over the brands selected at QBrand asking a rating and an open-end for each.
- Turn this Word survey into DSL and list every assumption you made.

## 5. Capabilities

- **Web Search / Browsing: OFF** — everything it needs is in Knowledge; browsing invites drift.
- **Canvas: optional** (handy for editing long output).
- **Code Interpreter: OFF** for a plain authoring test. Turn it **ON** only if you want
  the GPT to self-lint (see below).
- **Image generation: OFF.**

## 6. Judging "acceptable" (the test loop)

1. Give the GPT a representative brief and let it produce the `.yml`.
2. Save its output to a file, e.g. `gpt-out.yml`.
3. Run the local checks:
   ```bash
   node lint/survey-dsl-lint.js gpt-out.yml     # mechanical: expect 0 errors
   ```
   Then import to a Fieldbase **test** project (the authoritative validator) or run your
   own validator wrapper.
4. Score it on: **0 lint errors**, **0 validator errors**, a **delta-log** with sensible
   assumptions, and correct flow/logic on a spot-check. Feed any errors back to the GPT
   ("the linter reports these — fix them") and see if it self-corrects.

## Self-linting inside the GPT (optional, advanced)

ChatGPT's Code Interpreter runs **Python**, so it can't run the Node `survey-dsl-lint.js`
— but the kit ships a byte-for-byte **Python port**, `lint/survey_dsl_lint.py`. To have
the GPT lint its own output before returning it:

1. Upload `lint/survey_dsl_lint.py` as a Knowledge file.
2. Turn **Code Interpreter ON** in Capabilities.
3. Add this to the end of the Instructions field:
   ```
   SELF-LINT. Before returning the .yml, use Code Interpreter to run the uploaded
   survey_dsl_lint.py on your output (write the .yml to a temp file and run
   `python3 survey_dsl_lint.py <file>`). Fix every reported error, re-run until it
   reports 0 errors, then return the corrected .yml. Note the linter is style/structure
   only — it is not a substitute for importing to Fieldbase.
   ```
