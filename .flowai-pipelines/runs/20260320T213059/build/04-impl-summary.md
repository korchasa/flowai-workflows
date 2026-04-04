## Summary

### Files changed

- `engine/types.ts` — added `fields?: string[]` to `ValidationRule` interface
- `engine/config.ts` — `validateValidationRule()`: made `sections` optional, added
  `fields` entry validation (non-empty strings), enforced "at least one of
  sections/fields" constraint
- `engine/validate.ts` — `checkArtifact()`: added inline frontmatter field presence
  check after sections check; fail-fast order: absent → empty → missing sections →
  missing/empty fields; updated success message to "Artifact validated: \${path}"
- `engine/config_test.ts` — updated 2 existing tests (error message changed from
  "non-empty 'sections'" to "requires at least one of 'sections' or 'fields'");
  added 3 new tests: non-string field rejected, empty-string field rejected,
  fields-only rule accepted
- `engine/validate_test.ts` — added 4 new tests: fields absent (skip passes),
  all fields present (pass), one field missing (fail), one field empty-valued (fail)

### Tests added or modified

- `engine/config_test.ts`: 2 tests updated + 3 new tests
- `engine/validate_test.ts`: 4 new tests

### `deno task check` result

PASS — 576 tests (7 new), 0 failed

---

## Iteration 2 Summary (QA Fix)

### Files Changed

- `documents/requirements-engine.md` — added §3.38 FR-E38 section with 7 acceptance
  criteria (all [x] with evidence), added FR-E38 Appendix row, removed duplicate FR-E36
  row from Appendix

### Tests Added or Modified

None (doc-only change).

### `deno task check` Result

PASS — 576 tests, 0 failures.
