# Survey DSL Kit

A **model-agnostic, freely distributable** kit that turns any capable AI (or a
human) into a competent Survey DSL programmer. It is two things and nothing more:

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

For an AI assistant: load `SURVEY-DSL-AUTHORING.md` as context (or via the shim in
[`integrations/`](integrations/) for your host), author the survey, then run the
linter before declaring the task done (§0.2 of the reference).

**Using Claude?** The easiest path is the bundled **Claude Skill** — add it to your Claude
once and it activates automatically every time you ask for a survey. See
[`integrations/claude-skill.md`](integrations/claude-skill.md). For ChatGPT, see
[`integrations/chatgpt-custom-gpt.md`](integrations/chatgpt-custom-gpt.md); for Gemini, see
[`integrations/gemini-gem.md`](integrations/gemini-gem.md).

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
integrations/             per-host shims + a drop-in Claude Skill (claude-skill/)
                          and setup guides (claude-skill.md, chatgpt-custom-gpt.md)
HANDOFF.md                what was done, provenance, linter calibration, findings
LICENSE                   MIT
```

## License

MIT — see [LICENSE](LICENSE). Free to distribute and adapt.
