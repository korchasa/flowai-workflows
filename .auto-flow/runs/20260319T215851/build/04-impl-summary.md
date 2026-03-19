## Summary

### Files Changed

- `.auto-flow/scripts/run-dashboard.sh` — New wrapper script. Runs
  `deno task dashboard --run-dir "$1"`, captures exit code; emits
  `[WARN] dashboard generation failed (exit $code)` to stderr on failure;
  always exits 0 so calling node remains "completed" (FR-S36).
- `.auto-flow/pipeline.yaml` — Replaced `after:` value in `tech-lead-review`
  node from `deno task dashboard --run-dir {{run_dir}} || true` to
  `.auto-flow/scripts/run-dashboard.sh {{run_dir}}`.

### Tests Added or Modified

None — both changes are a shell script and a config edit. No new TypeScript
logic introduced; existing 528 tests serve as regression gate.

### Check Status

PASS — `deno task check`: 528 tests passed, 0 failed; pipeline config valid;
all checks passed.
