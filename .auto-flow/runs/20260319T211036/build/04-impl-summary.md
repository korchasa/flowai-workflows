## Summary

### Files Changed

- **`engine/engine.ts`** — Added `this.output.status()` info log at the
  `on_error: continue` branch (~lines 384–390) before `return true`. Log
  format: `node <id>: failure suppressed by on_error: continue`.
- **`engine/engine_test.ts`** — Added `executePostPipeline` to import from
  `./post-pipeline.ts`; added 5 FR-E34 interaction tests (lines 1009–1168).
- **`documents/requirements-engine.md`** — Added section 3.34 FR-E34 with
  description, rationale, 4 interaction rules, and 5 acceptance criteria (all
  marked `[x]` with evidence); added Appendix cross-reference row.

### Tests Added

Five new tests in `engine/engine_test.ts` under `// --- FR-E34: on_error: continue interaction tests ---`:

1. `FR-E34 — continue-d failure: info log emitted, hook not called` — verifies
   info log emitted by mock `executeNode` and hook NOT called when
   `pipelineSuccess=true`.
2. `FR-E34 — all failures continue-d: pipelineSuccess true, hook not called` —
   replicates `executeLevel` loop pattern (2 continue-d nodes), asserts
   `pipelineSuccess=true` and no hook invocation.
3. `FR-E34 — one fatal failure among continue-d: hook called exactly once` —
   loop with one continue-d + one fatal failure → `pipelineSuccess=false` →
   asserts hook called exactly once.
4. `FR-E34 — hook script fails after continue-d failure: warn emitted, no re-trigger` —
   failing hook script emits WARN and no "Failure hook completed" log.
5. `FR-E34 — log message format: failure suppressed by on_error: continue` —
   verifies `OutputManager.status()` output contains the exact suppression phrase.

### Note on SDS

`documents/design-engine.md` was pre-populated by the Tech Lead with FR-E34
content (§5 Error Handling Precedence, §6 Non-Functional fault description).
No changes required.

### `deno task check` Result

PASS — 524 tests passed, 0 failed. All checks passed.
