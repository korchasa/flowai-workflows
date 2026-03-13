---
variant: "Variant A: Verify-and-close (no code changes)"
tasks:
  - desc: "Run deno task check to confirm FR-31 test suite passes"
    files: ["engine/config_test.ts"]
  - desc: "Verify SRS §3.30 evidence line numbers match current source"
    files: ["documents/requirements.md", "engine/config.ts"]
  - desc: "Post close-summary on issue #44 with evidence and close"
    files: []
---

## Justification

**Selected Variant A** over B and C for the following reasons:

1. **FR-31 is fully implemented.** All 7 acceptance criteria carry `[x]` with
   evidence pointers (commit `3e03fa1`). `validatePromptPaths()` and
   `readPromptContent()` in `engine/config.ts:367-395` perform batch validation
   at config load. Test suite (`engine/config_test.ts:629-772`) covers: missing
   file, existing file, template skip, multiple missing, loop body miss, and
   `prompt_content` population.

2. **Variant B rejected (marginal value).** The proposed incident-replay test
   (`agents/committer/SKILL.md` missing) exercises the identical code path as
   the existing `parseConfig — missing prompt file throws` test. The committer
   node was removed (FR-26), making the scenario permanently non-reproducible in
   production config. Documentation-as-test value does not justify the
   maintenance cost.

3. **Variant C rejected (out of scope).** Spec §Scope Boundaries explicitly
   excludes "Validation of non-`prompt` fields." Extending validation to
   `on_failure_script` and HITL script paths would require scope negotiation and
   introduces escape-hatch complexity (`--skip-script-validation`). Better
   addressed as a separate issue if needed.

4. **Vision alignment (AGENTS.md):** The project vision targets fully autonomous
   pipeline operation. FR-31 already prevents the class of failures that
   triggered issue #44 (wasted compute on invalid prompt paths). No further
   engine changes needed — the issue is resolved. Closing with evidence supports
   the "keep project in working condition" mandate.

## Task Descriptions

### Task 1: Run `deno task check` to confirm FR-31 test suite passes

Execute `deno task check` to verify all engine tests pass, specifically the
FR-31 prompt path validation suite in `engine/config_test.ts:629-772`. This
confirms the fix is not regressed.

- **Files (read-only):** `engine/config_test.ts`
- **Verification:** All tests green, zero failures.

### Task 2: Verify SRS §3.30 evidence line numbers match current source

Cross-reference the evidence line numbers in `documents/requirements.md` §3.30
(FR-31 acceptance criteria) against current `engine/config.ts` source. If line
numbers have drifted since commit `3e03fa1`, update the evidence pointers to
current positions.

- **Files:** `documents/requirements.md` (update if drifted),
  `engine/config.ts` (read-only)
- **Verification:** All `[x]` criteria point to correct current line numbers.

### Task 3: Post close-summary on issue #44 and close

Post a comment on GitHub issue #44 summarizing: FR-31 implementation status,
test evidence, and the verify-and-close decision. Then close the issue.

- **Files:** None (GitHub API only)
- **Verification:** Issue #44 is closed with summary comment.
