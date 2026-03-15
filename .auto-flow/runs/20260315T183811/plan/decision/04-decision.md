---
variant: "Variant C: Free function + reuse interpolate()"
tasks:
  - desc: "Add prepare_command field to PipelineDefaults in types.ts"
    files: ["engine/types.ts"]
  - desc: "Add prepare_command default to DEFAULT_PIPELINE_DEFAULTS in config.ts"
    files: ["engine/config.ts"]
  - desc: "Add runPrepareCommand() free function and call site in engine.ts"
    files: ["engine/engine.ts"]
  - desc: "Add tests: fresh-run exec, resume skip, failure abort, template interpolation"
    files: ["engine/engine_test.ts"]
---

## Justification

I selected Variant C for three reasons:

1. **Minimal footprint (S effort, 4 files).** No new modules — aligns with
   AGENTS.md principle of avoiding over-engineering. Variant B's dedicated
   `prepare.ts` + `interpolatePrepare()` creates a second template system for
   a ~30-line feature.

2. **Reuses existing `interpolate()` from `template.ts`.** No duplication of
   template logic (unlike B). `node_dir: ""` and `input: {}` in the
   `TemplateContext` are acceptable: FR-E30 spec explicitly limits supported
   variables to `run_dir`, `run_id`, `env.*`, `args.*`. Using `{{node_dir}}`
   or `{{input.*}}` in `prepare_command` yields empty string — fail-fast
   semantics (consistent with project strategy).

3. **Testable without Engine instantiation.** Free function pattern (unlike A's
   private method) enables direct unit testing. Matches existing patterns in
   `engine.ts` (e.g., post-pipeline hook execution is already function-based).

Vision alignment: Engine remains domain-agnostic — `prepare_command` is a
generic lifecycle hook with template interpolation, no domain-specific logic.

## Task Descriptions

### Task 1: Add `prepare_command` to `PipelineDefaults` (types.ts)

Add `prepare_command?: string` to the `PipelineDefaults` interface. Optional
field — pipelines without it are unaffected.

### Task 2: Add default in config.ts

Add `prepare_command: ""` to `DEFAULT_PIPELINE_DEFAULTS` object. Empty string
= no-op (guard in engine.ts skips empty/undefined).

### Task 3: Add `runPrepareCommand()` + call site (engine.ts)

Export `runPrepareCommand(cmd: string, runDir: string, runId: string, env: Record<string, string>, args: Record<string, string>, output: OutputManager): Promise<void>`.

Implementation:
- Build `TemplateContext` with `node_dir: ""`, `input: {}`, real `run_dir`,
  `run_id`, `env`, `args`.
- Call `interpolate(cmd, ctx)` to resolve template variables.
- Execute via `Deno.Command("sh", { args: ["-c", interpolated] })`.
- On non-zero exit: throw (caught by `run()` → state saved → pipeline aborts).
- Call site: `runWithLock()`, after `ensureRunDirs()` + `saveState()`, before
  level loop. Guarded by `!this.options.resume && cmd`.

### Task 4: Tests (engine_test.ts)

4 test cases following TDD:
- **Fresh-run exec:** Pipeline with `prepare_command: "echo ok"` — verify
  command runs (check side-effect or mock).
- **Resume skip:** `--resume` run — verify `prepare_command` NOT executed.
- **Failure abort:** `prepare_command: "exit 1"` — verify pipeline aborts with
  error state.
- **Template interpolation:** `prepare_command: "echo {{run_id}}"` — verify
  `run_id` is interpolated in executed command.

## Summary

I selected Variant C (free function + reuse `interpolate()`) for its minimal
footprint, zero template duplication, and testability. I defined 4 tasks
(types → config → engine function + call site → tests) ordered by dependency.
I created branch `sdlc/issue-116` and will open a draft PR with SDS updates.
