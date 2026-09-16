# Fieldbase AI SP Kit

A **model-agnostic, freely distributable** kit that turns any capable AI (or a
human) into a competent **Fieldbase survey programmer (SP)** — authoring surveys in
Fieldbase's Survey DSL. It is two things and nothing more:

1. **[`SURVEY-DSL-AUTHORING.md`](SURVEY-DSL-AUTHORING.md)** — the complete authoring
   reference (the *knowledge*). Question types, properties, styles, flow blocks,
   reusable lists, multilingual & multi-country patterns, and the hard rules. Any
   AI ingests this the same way — there is no model, no fine-tune, no API key, and
   nothing provider-specific.
2. **[`lint/survey-dsl-lint.js`](lint/survey-dsl-lint.js)** — a standalone,
   zero-dependency **style/structure linter** (the *lint pass*). Node only; no
   engine, no network.

That's the whole kit. Point any assistant at the reference, have it author `.yml`,
run the linter, fix what it flags. Because it's just a Markdown file plus one Node
script, it drops into anything: a Claude/Cursor/Copilot/Continue project, a custom
agent, a CI step, or a person's editor.

**Target platform.** The DSL is authored for the **Fieldbase survey platform**
(<https://thefieldbase.com>) — the `.yml` is imported and published there, which runs
the authoritative validator, the respondent runtime, quotas, translations, and export.
This kit is the *authoring* front-end; Fieldbase is where surveys actually run. The
reference tracks the Fieldbase DSL contract as of engine **v3.34.0**.

## Quick start

```bash
# Lint one or more authored surveys
node lint/survey-dsl-lint.js my-survey.yml
node lint/survey-dsl-lint.js examples/*.yml
# Exit code 0 = no errors (warnings allowed); 1 = errors.
```

Prefer Python (e.g. a ChatGPT Code Interpreter sandbox, or Python CI)? A byte-for-byte
port is bundled — same rules, messages, and exit codes:

```bash
python3 lint/survey_dsl_lint.py my-survey.yml
```

### Use it with an AI assistant

Ready-to-use, **self-contained bundles** for the assistants we've tested live in
[`bundles/`](bundles/) — each holds the reference, the examples, the linter, and a clear
per-assistant guide (grab just the one folder you need):

- **Claude** — a drop-in Skill: add it once, it activates automatically → [`bundles/claude/HOW-TO.md`](bundles/claude/HOW-TO.md)
- **ChatGPT** — a custom GPT → [`bundles/chatgpt/HOW-TO.md`](bundles/chatgpt/HOW-TO.md)
- **Gemini** — a Gem → [`bundles/gemini/HOW-TO.md`](bundles/gemini/HOW-TO.md)

> **⚠️ Use a flagship model.** These assistants only produce reliable surveys on their
> strongest tier (GPT-5-class, Claude Opus/Sonnet at high effort, Gemini **Pro** — not
> Flash/mini). A fast tier passes the linter but *silently drops logic* (quota checks,
> validations). See **Tested with** below, and always import to a Fieldbase test project
> before fielding.

For an IDE (Cursor / Copilot / Continue) or a Claude Code project, the shims in
[`integrations/`](integrations/) (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`) point the tool
at the reference.

## Tested with

All on the identical brief (a 36-question multi-market tracker), checked against the
platform's real validator. A clean validator result proves **syntax, not logic** — always
import to a Fieldbase test project.

| Assistant (model) | Validator | Result |
|---|---|---|
| **Claude** (Opus 5, high) | 0 errors | Complete and thorough — cleanest output. |
| **ChatGPT** (GPT-5.6 Sol) | 0 errors | Complete; a few cosmetic duplicate-helper warnings. |
| **Gemini** (3.1 Pro) | 0 errors | Complete, but the weakest of the three: left one empty quota `- script:` block and used a single generic error message instead of a pipeable error bank — review those. |
| Gemini (Flash) — *not recommended* | 0 errors | **Passed validation but dropped logic**: no quota checks, no validations, a required question a respondent couldn't answer. Use Pro instead. |

The takeaway: the differentiator is **model tier, not vendor** — use the flagship tier.

## What the linter is — and isn't

It catches the frequent, **mechanical** mistakes fast and offline: tabs / non-4-space
indentation, non-numeric or negative codes, `true`/`false` vs `True`/`False`, inline
`{k: v}` options, underscored ids, `Q.any(` without `.selected`, snake_case `style:`,
`style: dropdown` on `gridSingle`, `questions:` on a `- loop:`, duplicate qids / loop
ids, multi-line `options.from:`, `continue`/`break` in scripts, and more.

It is **not** a compiler. It does not resolve the grammar or a symbol table, so it
does not catch deep semantic errors (an unknown qid referenced in a script, a
required question with an empty option set, etc.). Those are caught by the
**platform's own validator** when the survey is imported or published. Treat a clean
lint as *"no obvious violations,"* not *"provably valid."* The linter and the
platform validator are complements.

## Layout

```
SURVEY-DSL-AUTHORING.md   the authoring reference (knowledge pack)
lint/survey-dsl-lint.js   the standalone style/structure linter (Node)
lint/survey_dsl_lint.py   byte-for-byte Python port (for Python/Code-Interpreter use)
examples/                 validator-clean example surveys (synthetic)
bundles/<ai>/             self-contained per-assistant bundles (chatgpt, claude, gemini):
                          reference + examples + linter + a per-assistant HOW-TO
integrations/             IDE/editor shims (CLAUDE.md, AGENTS.md, .cursorrules)
scripts/build-bundles.sh  regenerate the bundles from the canonical files
HANDOFF.md                internal notes (not for distribution)
LICENSE                   MIT
```

## License

MIT — see [LICENSE](LICENSE). Free to distribute and adapt.
