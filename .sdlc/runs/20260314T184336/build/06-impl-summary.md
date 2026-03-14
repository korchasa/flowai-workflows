## Summary

### Files Changed

- `.auto-flow/pipeline.yaml` — moved from `.sdlc/pipeline.yaml`; updated all
  internal paths: `on_failure_script`, `hitl.ask_script`, `hitl.check_script`,
  and all 7 `prompt:` fields to use `.auto-flow/agents/agent-*/SKILL.md`
- `.auto-flow/agents/agent-{pm,architect,tech-lead,developer,qa,tech-lead-review,meta-agent}/SKILL.md`
  — moved from `.claude/skills/agent-*/SKILL.md` (canonical location)
- `.auto-flow/scripts/{hitl-ask.sh,hitl-check.sh,rollback-uncommitted.sh,lib.sh,lib_test.ts}`
  — moved from `.sdlc/scripts/`
- `.auto-flow/tasks/{fr-1-trigger-modes.md,fr-18-verbose-output.md,fr-19-agents-as-skills.md,observability-gaps.md,safety-net.md}`
  — moved from `.sdlc/tasks/`
- `.claude/skills/agent-*` — replaced 7 directories with symlinks to
  `../../.auto-flow/agents/agent-*/` for Claude Code interactive discovery
- `.sdlc/scripts/stage-{1..9}.sh` and `stage-{1..9}_test.ts` — deleted
  (deprecated per FR-S26)
- `scripts/check.ts` — updated `pipelinePath` to `.auto-flow/pipeline.yaml`,
  `testDirs` from `.sdlc` to `.auto-flow`, comment-scan exclusion pattern
- `deno.json` — `run` task: added `--config .auto-flow/pipeline.yaml`;
  removed 9 legacy `test:*` stage tasks; updated `test:lib` path; updated
  fmt/lint excludes to include `.auto-flow/agents/`
- `.gitignore` — added `.auto-flow/runs/` (kept `.sdlc/runs/` for engine compat)
- `.gitleaks.toml` — updated allowlist paths from `.claude/skills/agent-*/`
  to `.auto-flow/agents/agent-*/` and `.sdlc/tasks/` to `.auto-flow/tasks/`
- `CLAUDE.md` — architecture section: `.sdlc/pipeline.yaml` →
  `.auto-flow/pipeline.yaml`, agent prompts path updated
- `README.md` — project structure, `--config` default, agent skills path updated
- `.auto-flow/agents/agent-meta-agent/SKILL.md` — cross-refs updated:
  `.claude/skills/agent-*/SKILL.md` → `.auto-flow/agents/agent-*/SKILL.md`
- `.auto-flow/agents/agent-tech-lead/SKILL.md` — cross-refs updated:
  `.claude/skills/agent-*/SKILL.md` → `.auto-flow/agents/agent-*/SKILL.md`
- `.auto-flow/agents/agent-developer/SKILL.md` — forbidden section updated:
  `.claude/skills/` → `.auto-flow/agents/`

### Tests Added or Modified

- `.auto-flow/scripts/lib_test.ts` — moved from `.sdlc/scripts/lib_test.ts`
  (no changes; 18 tests pass at new location)
- `engine/pipeline_integrity_test.ts` — updated `PIPELINE_PATH` to
  `.auto-flow/pipeline.yaml`

### Check Status

`deno task check`: **PASS** — 422 tests passed, 0 failed. Pipeline integrity
valid at `.auto-flow/pipeline.yaml`. Agent symlinks valid.
