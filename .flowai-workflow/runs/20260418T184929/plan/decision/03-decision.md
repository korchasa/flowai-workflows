---
variant: "Variant A: Inline Budget Checks in Existing Flow"
tasks:
  - desc: "Add budget types to types.ts"
    files: ["engine/types.ts"]
  - desc: "Parse --budget CLI flag in cli.ts"
    files: ["engine/cli.ts", "engine/cli_test.ts"]
  - desc: "Validate budget fields and cascade merge in config.ts"
    files: ["engine/config.ts", "engine/config_test.ts"]
  - desc: "Add workflow-wide and per-node budget checks in engine.ts"
    files: ["engine/engine.ts"]
  - desc: "Add loop budget pre-check with budget_preempt in loop.ts"
    files: ["engine/loop.ts", "engine/loop_test.ts"]
  - desc: "Emit --max-turns via extraArgs in agent.ts"
    files: ["engine/agent.ts", "engine/agent_test.ts"]
  - desc: "Add state budget exceeded tests"
    files: ["engine/state_test.ts"]
---

## Justification

I selected **Variant A** (Inline Budget Checks) over Variant B (dedicated
module) and Variant C (config-time resolution) for these reasons:

1. **Proportional complexity:** Budget enforcement is 4 conditionals total —
   2 in `engine.ts` (workflow-wide + per-node after `markNodeCompleted()`) and
   2 in `loop.ts` (workflow budget after body node + pre-check before iteration
   spawn). A dedicated `budget.ts` module (Variant B) or config-time resolved
   `_resolved_budget` field (Variant C) adds files/abstractions without
   matching benefit for ~20 lines of logic.

2. **Follows existing patterns:** Budget cascade (node → loop → defaults)
   naturally extends the existing `mergeDefaults()` pattern in `config.ts`
   (same pattern used for `model`, `runtime`, `on_failure_script`). Pure-function
   unit tests for cascade resolution live in `config_test.ts` — no new test
   file needed. Per AGENTS.md: "no premature abstraction."

3. **Co-location with cost tracking:** FR-E17 cost aggregation already happens
   in `engine.ts` (`markNodeCompleted()` → `updateRunCost()`) and `loop.ts`
   (body node cost accumulation). Budget checks sit directly after these sites,
   making the enforcement flow obvious in the code path.

4. **Smallest diff (effort S):** No new modules, no new barrel exports, no new
   internal conventions. Aligns with AGENTS.md's "domain-agnostic DAG executor"
   vision — budget is a workflow-level concern, not an architectural subsystem.

5. **`--max-turns` limitation acknowledged:** The Claude-only `--max-turns`
   flag is explicitly excluded from cross-runtime support per spec's scope
   boundaries. Agent.ts emits it via `extraArgs` (same pattern as `--model`).

## Task Descriptions

### Task 1: Add budget types to types.ts

Add `budget_usd?: number` to `EngineOptions` (~line 308). Add
`budget?: { max_usd?: number; max_turns?: number }` to `NodeConfig` (~line 83)
and `WorkflowDefaults` (~line 57). These are optional fields — no breaking
changes to existing workflows.

### Task 2: Parse --budget CLI flag in cli.ts

In `parseArgs()` (~line 73), add `--budget <USD>` parsing. Convert to float,
validate positive. Map to `EngineOptions.budget_usd`. Add to `--help` output
text. Add unit tests in `cli_test.ts` for valid/invalid `--budget` values.

### Task 3: Validate budget fields and cascade merge in config.ts

In `validateNode()` (~line 212): validate `budget.max_usd` (positive number)
and `budget.max_turns` (positive integer) when present. In `mergeDefaults()`
(~line 608): cascade merge `budget` field: node.budget → loop parent budget →
defaults.budget (same pattern as existing `model` cascade). Add tests in
`config_test.ts` for validation and cascade.

### Task 4: Add workflow-wide and per-node budget checks in engine.ts

After `markNodeCompleted()` (~line 435): check
`state.total_cost_usd > options.budget_usd` → abort workflow with clear error.
Per-node check: compare `node.cost_usd > resolvedBudget.max_usd` → fail node
(not workflow). Pass `budget_usd` through to loop executor.

### Task 5: Add loop budget pre-check with budget_preempt in loop.ts

After each body node `markNodeCompleted()` (~line 134): check workflow budget.
Before iteration spawn: compute `avgIterCost = totalLoopCost / iterationCount`.
If `avgIterCost > remainingBudget` → exit loop with `budget_preempt` reason.
Skip pre-check on first iteration (no data). Add tests for pre-check trigger
and exceeded scenarios.

### Task 6: Emit --max-turns via extraArgs in agent.ts

In `runAgent()`, if resolved `budget.max_turns` is present, append
`--max-turns <N>` to `extraArgs` (~line 180 and 290). Add test verifying
arg emission. Claude-only — other runtimes silently ignore unknown flags.

### Task 7: Add state budget exceeded tests

Test scenarios in `state_test.ts`: workflow-level budget exceeded detection,
per-node cost accumulation exceeding budget, total_cost_usd tracking with
budget_usd comparison.

## Summary

Selected Variant A (Inline Budget Checks) for FR-E47. Budget enforcement adds
4 inline conditionals to existing cost-tracking sites in engine.ts and loop.ts,
follows established mergeDefaults() cascade pattern, and requires no new
modules. 7 tasks ordered by dependency (types first, then CLI/config, then
runtime checks). Branch `sdlc/issue-187` created with draft PR.
