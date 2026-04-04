---
variant: "Variant B: Dedicated scope-check module with validation-rule integration"
tasks:
  - desc: "Add allowed_paths to NodeConfig type and scope_check to ValidationRule type union"
    files: ["engine/types.ts"]
  - desc: "Add allowed_paths config validation in validateNode()"
    files: ["engine/config.ts"]
  - desc: "Create scope-check module with snapshotModifiedFiles() and findViolations()"
    files: ["engine/scope-check.ts"]
  - desc: "Integrate pre/post snapshot in agent.ts continuation loop"
    files: ["engine/agent.ts"]
  - desc: "Unit tests for scope-check pure functions and agent integration"
    files: ["engine/scope-check_test.ts", "engine/agent_test.ts"]
---

## Justification

I selected Variant B for three reasons:

1. **Domain-agnostic architecture** (AGENTS.md: "Engine is domain-agnostic") —
   isolated `scope-check.ts` module keeps scope-check logic out of `agent.ts`.
   The continuation loop body stays focused on invoke → validate → decide.
   `findViolations()` is a pure function testable without I/O.

2. **Validation mechanism reuse** — injecting a synthetic `ValidationResult`
   (type `scope_check`) into the existing validation results array means
   scope violations share the continuation budget with artifact validation
   (AC #7) and reuse the same resume-prompt formatting. No new control flow
   in `agent.ts`.

3. **Git efficiency** — `git diff --name-only HEAD` +
   `git ls-files --others --exclude-standard` is sub-second for ≤1000 files
   (AC #6). Engine already depends on git. Variant C's filesystem hashing
   reinvents this at higher cost and complexity.

Variant A rejected: inlining scope-check in `agent.ts` increases module
complexity (3 sequential checks in loop body) and reduces testability.
Variant C rejected: git-independent hashing is overkill — performance risk
for large repos, no benefit given existing git dependency.

## Task Descriptions

### Task 1: Add allowed_paths to NodeConfig and scope_check to ValidationRule

Add `allowed_paths?: string[]` to `NodeConfig` in `types.ts`. Add
`"scope_check"` to the `ValidationRule.type` union as an internal-only type
(engine auto-injects, not user-configured in YAML).

### Task 2: Add allowed_paths config validation

In `config.ts` `validateNode()`: when `allowed_paths` present on a node,
validate it is an array of non-empty strings. Invalid → config error at parse
time. Consistent with existing validation patterns (e.g., `run_on`, `env`).

### Task 3: Create scope-check module

New `engine/scope-check.ts` with two exports:
- `snapshotModifiedFiles(): Promise<Set<string>>` — runs
  `git diff --name-only HEAD` + `git ls-files --others --exclude-standard`,
  returns combined set of modified/untracked files.
- `findViolations(before: Set<string>, after: Set<string>, allowedPaths: string[]): string[]`
  — pure function. Computes `after − before` (new modifications), filters
  against `allowedPaths` globs. Returns violation paths. Empty array = no
  violations.

### Task 4: Integrate pre/post snapshot in agent.ts

In `runAgent()`: if `node.allowed_paths` exists, call
`snapshotModifiedFiles()` before first `invokeClaudeCli()` → store as
`beforeSnapshot`. After each invocation, snapshot again → `findViolations()`.
If violations found, inject synthetic `ValidationResult` (failed, type
`scope_check`, message listing violations) into validation results array.
Continuation resume prompt includes both artifact and scope violations.
Skip entirely when `allowed_paths` undefined.

### Task 5: Unit tests

- `scope-check_test.ts`: test `findViolations()` pure function (no violations,
  violations detected, glob matching, empty sets). Test
  `snapshotModifiedFiles()` with git fixture.
- `agent_test.ts`: test scope-check integration (snapshot injection, shared
  continuation budget).

## Summary

I selected Variant B (dedicated `scope-check.ts` module with validation-rule
integration). The approach isolates scope-check logic in a testable module,
reuses the existing validation/continuation mechanism, and uses git for
sub-second diffing. 5 tasks ordered by dependency. Branch `sdlc/issue-175`
created, draft PR opened.
