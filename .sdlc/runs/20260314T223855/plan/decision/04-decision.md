---
variant: "Variant A: Evidence-Only (Verification + FR-E24 Creation)"
tasks:
  - desc: "Add FR-E24 section to documents/requirements-engine.md with acceptance criteria and evidence"
    files: ["documents/requirements-engine.md"]
  - desc: "Run deno task check and full test suite to verify no regressions"
    files: []
---

# Decision: Issue #92

## Justification

I selected **Variant A (Evidence-Only)** for the following reasons:

1. **Spec alignment:** The PM spec explicitly defers "unit tests for newly
   extracted modules beyond what exists" and scopes this as documentation-only
   completion. Variants B and C introduce code changes (test migration, re-export
   removal) that exceed the spec's stated scope boundaries.

2. **Refactoring already complete:** The Architect confirmed engine.ts is at 435
   LOC (target <=500). All extractions (`agent-node.ts`, `node-dispatch.ts`,
   `merge.ts`, `hitl.ts`, `loop.ts`) are done across 4 commits. No code changes
   are needed.

3. **Risk minimization:** Variant A has zero code change surface. Variants B/C
   risk transient test breakage during migration and potential import chain
   disruption. The re-exports in `engine.ts:428-435` are harmless backward
   compatibility preservers.

4. **Vision alignment (AGENTS.md):** The project vision emphasizes
   domain-agnostic engine development via dogfooding. Completing FR-E24 evidence
   marking closes the documentation loop for this refactoring without
   introducing unnecessary churn. The "fail fast, fail clearly" principle favors
   the minimal path when the work is already done.

5. **Effort:** Size S vs M for Variants B/C. Single-task implementation.

## Task Descriptions

### Task 1: Add FR-E24 to engine SRS with acceptance criteria and evidence

Add a new `### 3.24 FR-E24: Engine Module Size Reduction` section to
`documents/requirements-engine.md`. Include acceptance criteria:

- `engine.ts` <= 500 LOC (evidence: 435 LOC current)
- `executeAgentNode` extracted to `agent-node.ts` (evidence: `engine/agent-node.ts`)
- `executeLoopNode` extracted to `loop.ts` (evidence: `engine/loop.ts`)
- `executeMergeNode` extracted to `merge.ts` (evidence: `engine/merge.ts`)
- `executeHumanNode` + utilities extracted to `node-dispatch.ts` (evidence: `engine/node-dispatch.ts`)
- All existing tests pass (no behavioral regression)

Mark all ACs `[x]` with file path evidence from existing code.

### Task 2: Run verification

Execute `deno task check` and full test suite (`deno task test`) to confirm zero
regressions. No code changes expected.

## Summary

I selected Variant A (Evidence-Only) for issue #92 because the refactoring is
already complete and the spec explicitly defers test co-location. I defined 2
tasks: FR-E24 creation with evidence marking, and verification. Branch
`sdlc/issue-92` and draft PR #106 already exist from prior implementation work.
