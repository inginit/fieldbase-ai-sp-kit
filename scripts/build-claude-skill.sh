#!/usr/bin/env bash
# Build the self-contained Claude Skill by copying the canonical files into it.
# Keeps integrations/claude-skill/ in sync with the pack, examples, and linter.
# Run after changing SURVEY-DSL-AUTHORING.md, examples/, or the linter.
set -euo pipefail
cd "$(dirname "$0")/.."

SK="integrations/claude-skill"
mkdir -p "$SK/examples"

cp SURVEY-DSL-AUTHORING.md "$SK/SURVEY-DSL-AUTHORING.md"
cp lint/survey_dsl_lint.py "$SK/survey_dsl_lint.py"
rm -f "$SK"/examples/*.yml
cp examples/*.yml "$SK/examples/"

echo "Built $SK (SKILL.md + $(ls "$SK"/examples/*.yml | wc -l | tr -d ' ') examples + reference + linter)"
