## Summary

### Files Changed

- `engine/agent-node.ts` (created): Extracted `executeAgentNode()` and
  `resolveInputArtifacts()` from `node-dispatch.ts` into a dedicated module.
- `engine/merge.ts` (created): Extracted `executeMergeNode()` and `copyDir()`
  from `node-dispatch.ts` into a dedicated module.
- `engine/loop.ts` (modified): Added `executeLoopNode()` export (moved from
  `node-dispatch.ts`); added imports for `getRunDir`, `saveAgentLog`, and
  `NodeExecutionContext`.
- `engine/node-dispatch.ts` (modified): Removed three extracted functions
  (`executeAgentNode`, `executeLoopNode`, `executeMergeNode`, `copyDir`,
  `resolveInputArtifacts`). Retained `NodeExecutionContext` interface,
  `executeHumanNode`, and all utility functions. Removed now-unused imports
  (`runAgent`, `runLoop`, `detectHitlRequest`, `runHitlLoop`, `saveAgentLog`,
  `getRunDir`, `markNodeWaiting`).
- `engine/engine.ts` (modified): Updated imports to use `executeAgentNode` from
  `./agent-node.ts`, `executeMergeNode` from `./merge.ts`, `executeLoopNode`
  from `./loop.ts`. Updated re-exports: `resolveInputArtifacts` from
  `./agent-node.ts`. Line count: 471 (≤500, satisfies FR-E24).
- `deno.json` (modified): Added `.auto-flow/` to fmt exclude list to prevent
  generated run-artifact HTML files from failing `deno fmt --check`.

### Tests Added or Modified

- `engine/engine_test.ts`: No changes required — all imports sourced from
  `engine.ts` which correctly re-exports all symbols.

### Check Status

PASS — `deno task check` completed with all checks passing (fmt, lint, secret
scan, tests, pipeline integrity, comment scan).
