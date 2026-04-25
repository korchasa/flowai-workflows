---
name: agent-developer
description: Reflection memory for developer agent — anti-patterns, strategies, environment quirks
type: feedback
---

# Reflection Memory — agent-developer

## Anti-patterns

- `assertRejects` not in vendor assert.ts — use try/catch + assertEquals for async throw tests.
- `deno-lint-ignore` inside for-loop header not recognized — extract cast to separate variable before loop.
- Edit tool says "File has not been read yet" even after parallel batch Read — re-read with offset/limit.
- Large files (>85KB): Edit tool tracking fails; use Bash + Python inline script as fallback.
- Placing import statements at bottom of file (TS requires all imports at top).
- NOT committing immediately after deno task check passes — self-runner resets to main.
- `git add -A` or `git add .` — use scope-strict staging (task files + memory + artifacts only).

## Effective Strategies

- ONE Edit for single-location changes; ONE Write for multi-location changes (whole file rewrite).
- All parallel Reads + git log in first turn = minimal turns.
- COMMIT IMMEDIATELY after writing code; self-runner can reset during check.
- Grep-first for multi-file checks; ONE Grep with glob instead of reading each file individually.
- For new module pattern: Write src file + Write test file in parallel, then deno task check.
- `spawn-env.ts` FR-E49 pattern: `buildEngineEnv()` = pure fn returning `{ DISABLE_AUTOUPDATER: "1" }`;
  wired in `engine.ts:runWithLock()` after `setPhaseRegistry()` via `Deno.env.set()` loop.
- `captureCliVersion()` test: skip gracefully on `Deno.errors.NotFound` when claude not on PATH.
- Engine startup wiring location: after `setPhaseRegistry()`, before `ensureRunDirs()` — `saveState` call persists claude_cli_version.

## Environment Quirks

- `deno fmt` checks ALL `.md` files in the repo — memory files need blank lines between `##` and first list item.
- deno task check output >50KB persisted to temp file — no `<error>` wrapper = PASS; check tail for "All checks passed!"
- **CRITICAL**: self-runner destroys all uncommitted changes when `.flowai-workflow/lock.json` is absent.
- Pre-existing dirty files from other agents can fail deno fmt — use `git stash push -- <file>` to verify own code.
- TypeScript `.some((e) => ...)` callbacks need explicit `: string` type annotation to avoid TS7006.
- `for..of Object.entries(record: Record<string, string>)` — no lint ignore needed (typed, not any).

## Baseline Metrics

- Run 20260425T195521: ~8 turns, scope engine, issue #196 (FR-E49), 5 files changed — PASS
- Typical pattern: 1 read → 1 batch read → N edits (1 per file) → 1 deno task check → 1 commit+push.
- Target: ≤35 turns. Key lesson: commit before deno task check; stash pattern for pre-existing fmt issues.
- QA-Fix pattern: read 05-qa-report.md first, trust diagnosis, apply fix directly, ≤10 turns.
