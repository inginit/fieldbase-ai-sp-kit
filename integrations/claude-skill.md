# Claude — the "give it to your Claude once" Skill

The kit ships as a **Claude Skill** in `integrations/claude-skill/`. Add it to your Claude
**one time** and it activates automatically every time you ask for a Fieldbase survey — no
per-chat setup, no pasting instructions again. This is the easiest way to consume the kit.

The skill is self-contained: it bundles the full authoring reference, the worked examples,
and the linter, so it works on its own with nothing else installed.

## Install it (pick your Claude)

### A. claude.ai (Pro / Max / Team / Enterprise)

1. Zip the skill folder so `SKILL.md` sits at the archive root:
   ```bash
   cd integrations/claude-skill && zip -r ../fieldbase-survey-dsl.zip .
   ```
2. In claude.ai: **Settings → Capabilities → Skills → Upload skill**, and pick
   `fieldbase-survey-dsl.zip`.
3. Done. In any chat, just ask — "write me a 10-minute smartphone survey", "convert this
   questionnaire to Fieldbase DSL" — and the skill activates on its own.

*(Skill upload requires a plan with Skills/code-execution enabled. If you don't see it, use
the Project fallback below.)*

### B. Claude Code (CLI / desktop)

Copy the folder into your skills directory:

```bash
# available in every project (personal):
cp -R integrations/claude-skill ~/.claude/skills/fieldbase-survey-dsl
# …or just this project:
cp -R integrations/claude-skill .claude/skills/fieldbase-survey-dsl
```

It auto-loads on the next run; ask for a survey and it triggers.

## Using it

Just describe what you want. The skill reads the bundled reference, authors one complete
`.yml`, and — if your Claude can run code — runs the bundled linter (`survey_dsl_lint.py`)
on its own output and fixes errors before handing it back. Import the result to a Fieldbase
**test** project to run the authoritative validator.

## Fallback: a Claude Project (no Skills capability)

If your plan can't upload Skills, make a Project instead — it persists so you reuse it
"again and again":

1. claude.ai → **Projects → New project**.
2. **Project knowledge:** upload `SURVEY-DSL-AUTHORING.md` and the `examples/*.yml`.
3. **Custom instructions:** paste the "How to use" + "Hard rules" text from
   `integrations/claude-skill/SKILL.md`.
4. Chat inside that project whenever you author a survey.

(A Project is shareable only within your workspace/Team, not the public internet — see the
kit README for the true public, zero-install option, a Claude-API-hosted assistant.)

## Maintainers

The skill folder contains **copies** of the pack, examples, and linter so it's portable.
After changing any of those, rebuild the skill so it stays in sync:

```bash
npm run build:skill      # or: bash scripts/build-claude-skill.sh
```
