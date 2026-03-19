## Summary

### Files Changed

- `engine/config.ts` — Added mutual-exclusivity validation in `validateSchema()`:
  after the existing `phases:` block validation, checks whether any node has a
  per-node `phase:` field when a top-level `phases:` block is also present.
  Throws a diagnostic error naming both mechanisms and all affected node IDs.

- `engine/state.ts` — Simplified `setPhaseRegistry()` from dual-mechanism merge
  logic to a clean if/else: `phases:` block path or per-node `phase:` path,
  never both. Relies on config validation to guarantee mutual exclusivity.

- `.auto-flow/pipeline.yaml` — Removed 5 redundant per-node `phase:` fields
  (`specification`, `design`, `decision`, `implementation`, `tech-lead-review`)
  that coexisted with the top-level `phases:` block. Necessary consequential
  fix: the new validation rejects configs using both mechanisms simultaneously.

### Tests Added / Modified

- `engine/config_test.ts` — 4 new tests (FR-E33 mutual-exclusivity):
  1. Both mechanisms coexist → rejects with "cannot coexist" diagnostic + node ID
  2. `phases:` block only → accepted
  3. Per-node `phase:` fields only → accepted
  4. Neither mechanism → accepted

- `engine/state_test.ts` — Replaced "top-level phases take priority over
  per-node phase" test (scenario is now impossible after config validation)
  with two tests:
  1. Phases-block-only: builds registry from `phases:` block
  2. Phase-field-only: builds registry from per-node `phase:` fields

### Check Status

`deno task check` — **PASS** (514 tests, 0 failed)
