---
variant: "Variant A: Self-contained checkArtifact"
tasks:
  - desc: "Extend ValidationRule type union and add sections field in types.ts"
    files: ["engine/types.ts"]
  - desc: "Add artifact rule schema validation in config.ts"
    files: ["engine/config.ts"]
  - desc: "Implement checkArtifact() and wire into runSingleValidation() switch"
    files: ["engine/validate.ts"]
  - desc: "Add config-time validation tests for artifact rule"
    files: ["engine/config_test.ts"]
  - desc: "Add runtime validation tests for artifact rule (all edge cases)"
    files: ["engine/validate_test.ts"]
---

## Justification

I selected Variant A (self-contained `checkArtifact`) over Variant B (compose
existing helpers) for these reasons:

- **Minimal change surface:** Only new code added — no existing function
  signatures or exports modified. Zero regression risk on `checkFileExists()` /
  `checkContainsSection()` callers.
- **Trivial duplication:** The shared logic is a single `escapeRegex` + heading
  regex pattern (~1 line). DRY benefit of Variant B does not justify the wider
  refactoring surface (M effort vs S effort).
- **Fail fast, fail clearly (AGENTS.md):** Simpler implementation = fewer
  failure modes. Self-contained function is easier to reason about and debug.
- **Engine domain-agnostic (AGENTS.md):** Both variants respect this — the
  `artifact` rule is a generic validation primitive (file + sections), not
  domain-specific.

## Task Descriptions

### Task 1: Extend ValidationRule type (types.ts)

Add `"artifact"` to the `ValidationRule.type` discriminated union. Add optional
`sections?: string[]` field to `ValidationRule`. No runtime logic — type-only
change.

### Task 2: Config-time schema validation (config.ts)

Add `"artifact"` to `validTypes` array in `validateValidationRule()`. Add
schema check: when `type === "artifact"`, `sections` must be a non-empty array
of strings. Missing/empty `sections` → config error at parse time.

### Task 3: Implement checkArtifact() (validate.ts)

New private `checkArtifact(path, sections)` function (~30 lines):
1. `Deno.stat(path)` — file absent → single error, return immediately (fail-fast).
2. `Deno.readTextFile(path)` — file empty → single error, return.
3. For each section in `sections[]`: apply heading regex (same pattern as
   `checkContainsSection`). Collect all missing sections.
4. Any missing → single aggregate `ValidationResult` listing all missing.
5. All present → pass.

Wire into `runSingleValidation()` switch: `case "artifact"`.

### Task 4: Config tests (config_test.ts)

- Artifact rule with missing `sections` → rejected.
- Artifact rule with empty `sections` array → rejected.
- Artifact rule with non-string elements in `sections` → rejected.
- Valid artifact rule → accepted.

### Task 5: Runtime tests (validate_test.ts)

- File absent → single error mentioning path.
- File empty → single error.
- All sections present → pass.
- Some sections missing → aggregate error listing all missing.
- All sections missing → aggregate error listing all.
- Template path interpolation works.

## Summary

I selected Variant A (self-contained `checkArtifact`). The duplicated heading
regex is trivial (~1 line) and the benefit of DRY refactoring (Variant B) does
not justify the wider change surface. 5 tasks ordered by dependency (types →
config → implementation → tests). Branch `sdlc/issue-146` created with draft PR.
