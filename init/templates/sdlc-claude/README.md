# Template: sdlc-claude

6-agent SDLC workflow for Claude Code runtime. Pipeline:

```
Project Manager -> Architect -> Tech Lead -> (Developer <-> QA loop) -> Tech Lead Review
```

## Status

**Framework-independent.** Agent prompts describe generic SDLC roles with
zero references to project-specific numbering schemes, documentation-
hierarchy conventions, or hardcoded tech stacks. Build gate and test
commands are parameterized via `__LINT_CMD__` / `__TEST_CMD__` placeholders,
filled by `flowai-workflow init` from the wizard.

Self-containment:

- All workflow assets live under `.flowai-workflow/` in the target project.
- Agent prompts at `.flowai-workflow/agents/agent-*.md`, NOT `.claude/agents/`.
- Memory at `.flowai-workflow/memory/` (empty stubs that agents rewrite at
  session end per `reflection-protocol.md`).
- Scripts at `.flowai-workflow/scripts/` (HITL only; no dashboard, rollback,
  or reset infrastructure — those were project-specific helpers removed
  during genericization).
- Gitignore at `.flowai-workflow/.gitignore` (just `runs/`). Init writes
  nothing outside this tree.

## Layout

```
files/.flowai-workflow/
├── .gitignore              # runs/
├── workflow.yaml           # DAG config
├── agents/                 # 6 agent system prompts
├── memory/                 # per-agent memory + reflection protocol
├── scripts/                # HITL, rollback, dashboard shell scripts
└── tasks/                  # placeholder
```

## Placeholders

Populated by `flowai-workflow init` from wizard answers. Regex pattern:
`__[A-Z][A-Z0-9_]*__`.

- `__PROJECT_NAME__` — workflow identifier, log prefix, state-file name.
- `__DEFAULT_BRANCH__` — base branch for PRs (autodetected from
  `git symbolic-ref refs/remotes/origin/HEAD`, fallback `main`).
- `__TEST_CMD__` — project test command (autodetected per-language from
  `deno.json`, `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`).
- `__LINT_CMD__` — project lint/format check command (same autodetect
  sources as `__TEST_CMD__`).

**Not yet wired:** placeholders are documented here but not yet
injected into `workflow.yaml` or agent prompts. Added during the
genericization pass.

## Hard dependencies

- `git` — version control, branch management.
- `gh` — GitHub issue triage, PR creation/merge.
- `claude` — Claude Code CLI, invoked by the engine for each agent node.
- GitHub remote on `origin` (not GitLab/Gitea/etc).

Preflight in `cli/init/preflight.ts` enforces all four.

## Not included

- `.claude/agents/` — agents live inside `.flowai-workflow/` for
  self-containment. Users who also want Claude Code native subagent
  invocation can symlink manually; not an init concern.
- Top-level `.gitignore` append — the template ships its own
  `.flowai-workflow/.gitignore` so init writes nothing outside the
  workflow directory.
- No bootstrap workflow, no AI adaptation step. Pure scaffold. Users
  edit agent prompts by hand if they want project-specific tuning.
