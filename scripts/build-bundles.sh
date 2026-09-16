#!/usr/bin/env bash
# Build the per-AI bundles by copying the canonical files into each.
# Each bundle is self-contained (reference + examples + linter) so a user can hand
# just that folder to one assistant. The hand-written guides (HOW-TO.md, and Claude's
# SKILL.md) are NOT touched. Run after changing the pack, examples, or linter.
set -euo pipefail
cd "$(dirname "$0")/.."

for ai in chatgpt claude gemini; do
  dst="bundles/$ai"
  mkdir -p "$dst/examples"
  cp SURVEY-DSL-AUTHORING.md "$dst/SURVEY-DSL-AUTHORING.md"
  cp lint/survey_dsl_lint.py "$dst/survey_dsl_lint.py"
  rm -f "$dst"/examples/*.yml
  cp examples/*.yml "$dst/examples/"
  echo "Built $dst"
done
