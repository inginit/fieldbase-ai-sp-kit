# Contributing

This kit is intentionally small: a knowledge pack, a zero-dependency linter, host
shims, and synthetic examples. Contributions should keep it that way.

## Adding or changing a rule

The linter (`lint/survey-dsl-lint.js`) and the reference (`SURVEY-DSL-AUTHORING.md`)
are kept in lock-step. When you add a rule:

1. Add a row to **§0.1** (the bright-line "✗ never / ✓ do" checklist) in the reference.
2. Add the check in `lint/survey-dsl-lint.js`. Follow the existing pattern:
   - Structural rules (indentation, codes, ids, styles, block shapes) run **outside**
     block scalars — put them after the `if (inScalar) continue;` guard.
   - Logic rules (things valid only in `script:`/`validation:`/`if:` code) run where
     `inCode` is true.
   - Use severity **`error`** only for something the platform validator would also
     reject; use **`warn`** when validity is context-dependent (so the linter never
     reports an error the validator would pass).
3. Add or extend an example under `examples/` that exercises it, and make sure the whole
   corpus stays clean: `npm run lint:examples`.

## Examples

- **Synthetic only.** Never commit a real client survey, a real source `.docx`, or any
  client/brand/pricing specifics. Use generic categories and placeholder values.
- Every example must be **validator-clean** on the platform, not just lint-clean. A
  clean lint is not proof of validity (see the scope note in §0.2).

## Scope

This kit does **not** ship the survey engine, the compiler, or the platform validator —
those stay on Fieldbase. Keep it dependency-free (Node stdlib only) so any AI or human
can run the linter anywhere.
