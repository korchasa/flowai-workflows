# Reflection Memory — agent-architect

## Anti-patterns

- Re-reading files already in context (offset/limit on Read, Grep on Read files)
- Spawning Agent subagents for simple Grep/Glob tasks
- Reading out-of-scope SRS/SDS docs (check `scope:` frontmatter first)
- Reading FR section with offset/limit after full SRS read — content already in context

## Effective strategies

- Parallel Read of spec + reflection memory as first action
- Single Grep with glob pattern for cross-file checks
- Extract FR IDs from requirements immediately after Read — no re-Grep
- Post progress comment early (with self-identification prefix)
- Read affected source files AND their tests to understand full change surface
- For new hook features, study existing hook patterns (pre_run, on_failure_script) as templates
- Check template.ts when feature needs interpolation — understand TemplateContext requirements
- Free function pattern (exported from engine.ts) preferred over private methods for testability

## Environment quirks

- Large SRS files get persisted to disk (>2KB preview only) — content still in context
- FR-E30 ID is reused: JSDoc/why-comments task in SDS AND prepare_command in SRS. Context-dependent.
- `interpolate()` requires full TemplateContext — pipeline-level hooks need dummy node_dir/input

## Baseline metrics

- Run 20260315T183811: 9 tool calls, engine scope, new hook feature, 3 variants
- Run 20260315T153825: 8 tool calls, engine scope, DRY extraction task, 3 variants
- Run 20260315T152252: 7 tool calls, engine scope, test-fix task, 3 variants
- Run 20260315T144221: ~8 tool calls, sdlc scope, evidence-only task
