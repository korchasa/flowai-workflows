---
variant: "Variant C: Extract executeAgentNode to agent.ts + executeLoopNode to loop.ts + move utilities"
tasks:
  - desc: "Extract executeAgentNode() to engine/agent.ts as free function with explicit params object"
    files: ["engine/engine.ts", "engine/agent.ts"]
  - desc: "Extract executeLoopNode() to engine/loop.ts as free function with explicit params object"
    files: ["engine/engine.ts", "engine/loop.ts"]
  - desc: "Move printSummary() to OutputManager method in engine/output.ts"
    files: ["engine/engine.ts", "engine/output.ts"]
  - desc: "Move copyDir() to engine/state.ts as exported utility"
    files: ["engine/engine.ts", "engine/state.ts"]
  - desc: "Update executeNode() in engine.ts to delegate to imported functions; verify all engine_test.ts tests pass"
    files: ["engine/engine.ts", "engine/engine_test.ts"]
---

## Justification

I selected Variant C because it reaches the <500 LOC target (~477 lines) without
creating new modules. Each extraction places code in its natural home:

- `executeAgentNode` (108 lines) → `engine/agent.ts` — agent execution logic
  belongs with agent infrastructure (`buildClaudeArgs`, `executeClaudeProcess`,
  `runAgent`). This is the single largest method and the highest-value extraction.
- `executeLoopNode` (56 lines) → `engine/loop.ts` — loop execution belongs with
  `runLoop`, `buildLoopBodyOrder`, loop context building.
- `printSummary` (22 lines) → `OutputManager` in `engine/output.ts` — summary
  rendering is an output concern, consistent with `nodeResult()`, `summary()`,
  `dryRunPlan()` already living there.
- `copyDir` (12 lines) → `engine/state.ts` — filesystem utility alongside
  `getNodeDir()`, `getRunDir()`.

This aligns with AGENTS.md vision of clean module separation: each engine module
has a single, well-defined responsibility. No catch-all modules. Existing module
boundaries are reused rather than new files created.

Variant A was a close second but creates a monolithic `node-exec.ts` that groups
all four node-type executors together — less cohesive than distributing them to
their natural domains. Variant B fails the <500 LOC target (~549 lines).

## Task Descriptions

### Task 1: Extract executeAgentNode() to engine/agent.ts

I move `executeAgentNode()` (lines 337-445 of `engine.ts`) to `agent.ts` as a
free function `executeAgentNode(params: AgentNodeParams)`. The params object
includes: `nodeId`, `nodeConfig`, `state`, `config`, `output` (OutputManager),
`options`, `ctx` (template context), `runDir`, `streamLogPath`. The function
mutates `state` via the reference (session_id, continuations). `engine.ts`
retains a thin call in `executeNode()` that imports and delegates.

### Task 2: Extract executeLoopNode() to engine/loop.ts

I move `executeLoopNode()` (lines 468-524 of `engine.ts`) to `loop.ts` as a
free function `executeLoopNode(params: LoopNodeParams)`. Params: `nodeId`,
`nodeConfig`, `state`, `config`, `output`, `options`, `ctx`, `runDir`. The
`onNodeComplete` callback (log saving, result display) is passed as a param
or inlined. `engine.ts` delegates from `executeNode()`.

### Task 3: Move printSummary() to OutputManager

I move `printSummary()` (lines 617-639 of `engine.ts`) to `output.ts` as a
method `OutputManager.printSummary(state: RunState, config: PipelineConfig)`.
The method builds `nodeResults` from `state.nodes[*].result` and calls the
existing `summary()` method. `engine.ts` replaces `this.printSummary()` with
`this.output.printSummary(this.state, this.config)`.

### Task 4: Move copyDir() to engine/state.ts

I move `copyDir()` (12 lines) to `state.ts` as an exported free function.
It's a filesystem utility used by `executeMergeNode()` — natural home alongside
`getNodeDir()`, `ensureRunDirs()`. Import added in `engine.ts`.

### Task 5: Update engine.ts dispatcher + verify tests

I update `executeNode()` to import and call the extracted functions. I verify
all existing `engine_test.ts` tests pass without modification. If any test
directly calls moved private methods, I update the import path. LOC target
verified: ~654 - 177 (moved) + ~15 (imports/delegation) = ~477 lines.

## Summary

I selected Variant C for its natural module placement and <500 LOC achievement
(~477 lines) without new files. I defined 5 ordered tasks: extract
`executeAgentNode` → `agent.ts`, extract `executeLoopNode` → `loop.ts`, move
`printSummary` → `OutputManager`, move `copyDir` → `state.ts`, update
dispatcher + verify tests. I created branch `sdlc/issue-92` and opened a draft PR.
