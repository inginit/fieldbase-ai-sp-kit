# Claude — add the Skill once, use it everywhere

This bundle is a self-contained Claude **Skill**: `SKILL.md` plus the authoring reference,
the worked examples, and the linter. Add it to your Claude **one time** and it activates
automatically whenever you ask for a Fieldbase survey — no per-chat setup.

> **⚠️ Use a flagship model.** Pick Claude's strongest model at high reasoning effort (e.g.
> Opus / Sonnet, "high"), not a fast/small tier. A fast tier can produce DSL that *passes
> validation but silently drops logic*. See the test table in the kit README. Whatever the
> model, always import the result to a Fieldbase **test** project before fielding — a clean
> check proves syntax, not logic.

## Install it (pick your Claude)

### A. claude.ai (Pro / Max / Team / Enterprise)

1. Zip this bundle so `SKILL.md` is at the archive root:
   ```bash
   cd bundles/claude && zip -r ../fieldbase-survey-dsl.zip .
   ```
2. claude.ai → **Settings → Capabilities → Skills → Upload skill** → pick the zip.
3. Done. In any chat, just ask — "write me a 10-minute smartphone survey", "convert this
   questionnaire to Fieldbase DSL" — and it activates on its own.

*(Skill upload needs a plan with Skills/code-execution enabled. If you don't have it, use
the Project fallback below.)*

### B. Claude Code (CLI / desktop)

```bash
cp -R bundles/claude ~/.claude/skills/fieldbase-survey-dsl   # every project
# …or just this project:
cp -R bundles/claude .claude/skills/fieldbase-survey-dsl
```
It auto-loads on the next run.

## Using it

Describe what you want. The skill reads the bundled reference, authors one complete `.yml`,
and — if your Claude can run code — runs the bundled `survey_dsl_lint.py` on its own output
and fixes errors before handing it back. Import the result to a Fieldbase **test** project.

## Fallback: a Claude Project (no Skills capability)

1. claude.ai → **Projects → New project**.
2. **Project knowledge:** upload `SURVEY-DSL-AUTHORING.md` and the `examples/*.yml`.
3. **Custom instructions:** paste the "How to use" + "Hard rules" sections from `SKILL.md`.
4. Chat inside that project whenever you author a survey.

## Check the result

```bash
python3 survey_dsl_lint.py claude-out.yml     # 0 errors expected; warnings advisory
```
