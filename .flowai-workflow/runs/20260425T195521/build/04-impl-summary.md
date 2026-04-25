## Summary

### Files Changed

- `types.ts` — added `claude_cli_version?: string` to `RunState` interface (optional, backward-compatible)
- `spawn-env.ts` — new module: `buildEngineEnv()` returns `{ DISABLE_AUTOUPDATER: "1" }`; `captureCliVersion(cwd?)` runs `claude --version` and returns trimmed stdout, throws on non-zero exit
- `spawn-env_test.ts` — new test file: 3 tests for `buildEngineEnv` always-wins semantics and `captureCliVersion` integration
- `engine.ts` — wired FR-E49 at run start in `runWithLock()`: apply `buildEngineEnv()` via `Deno.env.set()`, capture CLI version into `state.claude_cli_version` before first `saveState` call
- `state_test.ts` — added roundtrip test verifying `claude_cli_version` survives JSON serialize/deserialize cycle

### Tests Added or Modified

- `spawn-env_test.ts` (new): 3 tests
- `state_test.ts` (modified): +1 roundtrip test for `claude_cli_version`

### deno task check Result

PASS — all checks passed including fmt, lint, type-check, tests, doc-lint, publish dry-run.
