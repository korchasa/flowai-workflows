## Summary

### Files changed

- **types.ts** — Added optional `claude_cli_version?: string` field to `RunState` for operator auditability (FR-E49)
- **agent.ts** — Added exported `buildSpawnEnv(nodeEnv?)` function that merges node-level env with engine-enforced `DISABLE_AUTOUPDATER=1` (engine wins on conflict); wired into both initial and continuation `adapter.invoke()` calls in `runAgent()`
- **hitl.ts** — Updated import to include `buildSpawnEnv`; wired `env: buildSpawnEnv(opts.node.env)` into `runtimeRun()` call in HITL resume path
- **loop.ts** — Added optional `env?` field to `LoopRunOptions` for API completeness (FR-E49); loop body agents get `DISABLE_AUTOUPDATER=1` automatically via `runAgent()`'s internal `buildSpawnEnv()` call
- **engine.ts** — Added `captureClaudeVersion()` helper that runs `claude --version`, parses first semver token, handles graceful failure; wired into `runWithLock()` after phase registry init and initial state save

### Tests added or modified

- **agent_test.ts** — Updated import to add `buildSpawnEnv`; added 5 unit tests for `buildSpawnEnv()`: always includes `DISABLE_AUTOUPDATER=1`, merges user env, engine wins on conflict, handles undefined/empty nodeEnv
- **engine_test.ts** — Added 3 tests for `RunState.claude_cli_version`: optional field accepts string, roundtrips through JSON serialization, absent from JSON when undefined

### deno task check result

PASS — `=== All checks passed! ===`
