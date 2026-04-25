---
name: flowai-workflow-init
description: >-
  Initialize a new flowai-workflow project. Analyzes the codebase to detect
  project settings, asks the user to confirm or adjust, then scaffolds
  the .flowai-workflow/ directory.
user-invocable: true
argument-hint: "[--template <name>] [--dry-run]"
---

# Initialize flowai-workflow Project

## Overview

Scaffold a `.flowai-workflow/` directory in the current project with workflow
config, agent definitions, memory files, and HITL scripts. The skill analyzes
the project to pre-fill settings, confirms them with the user, then runs
`flowai-workflow init` non-interactively.

## Instructions

**Narration rule:** before every step below, print one short sentence
telling the user what you are about to do (what will be read, what will
be written, what command will run). The goal is no surprises — the user
should always know the next action before it happens. Do not bundle
multiple steps into one announcement; narrate each one as you reach it.

### 1. Pre-check

Announce first, e.g.:
"Checking whether `.flowai-workflow/` already exists (read-only)."

- If `.flowai-workflow/` already exists, inform the user and STOP. Do not
  overwrite without explicit confirmation. If the user confirms re-init,
  they must remove the directory manually first.

### 2. Analyze the project

Announce first, e.g.:
"Reading `deno.json` / `package.json` / `go.mod` / `Cargo.toml` /
`pyproject.toml` and `git` metadata to detect project settings. Nothing
is modified."

Read manifest files to detect:

- **PROJECT_NAME** — from `deno.json` → `name`, `package.json` → `name`,
  `go.mod` → module path basename, `Cargo.toml` → `[package] name`,
  `pyproject.toml` → `[project] name`. Fallback: current directory name.
- **DEFAULT_BRANCH** — run `git symbolic-ref refs/remotes/origin/HEAD`,
  extract branch name after `refs/remotes/origin/`. Fallback: `main`.
- **CHECK_CMD** — single command that runs all project checks (format, lint,
  tests). Detect from: `deno.json` → `tasks.check`, `package.json` →
  `scripts.check` or `scripts.test`, or by stack: `cargo test` (Rust),
  `go test ./...` (Go), `pytest` (Python). If no check task but separate
  lint and test tasks exist, combine them: e.g. `npm run lint && npm test`.

### 3. Confirm with user

Announce first, e.g.:
"Showing the detected values; I will wait for your confirmation before
running init."

Present detected values and ask the user to confirm or edit:

```
I detected the following project settings:

  PROJECT_NAME:    <detected>
  DEFAULT_BRANCH:  <detected>
  CHECK_CMD:       <detected or empty>

Are these correct? If not, tell me what to change.
```

Wait for user response. Apply any corrections.

### 4. Run init

Announce first, e.g.:
"Writing `/tmp/flowai-init-answers.yaml` (temp answers file) and running
`flowai-workflow init`. This creates `.flowai-workflow/` in the project
root; no other paths are touched. The temp file is removed after init."

Write a temporary YAML answers file. The template uses two separate
placeholders (`TEST_CMD`, `LINT_CMD`) — pass the single CHECK_CMD as both:

```bash
cat > /tmp/flowai-init-answers.yaml << 'EOF'
PROJECT_NAME: "<value>"
DEFAULT_BRANCH: "<value>"
TEST_CMD: "<CHECK_CMD value>"
LINT_CMD: "<CHECK_CMD value>"
EOF

flowai-workflow init --answers /tmp/flowai-init-answers.yaml
rm /tmp/flowai-init-answers.yaml
```

Pass through any user-provided flags (`--template`, `--dry-run`,
`--allow-dirty`).

If init fails due to uncommitted changes, ask the user whether to pass
`--allow-dirty` or commit first, then retry.

### 5. Post-init guidance

Announce first, e.g.:
"Init finished. Printing follow-up steps; nothing else will be changed."


After successful scaffold, tell the user:

1. Review agents in `.flowai-workflow/agents/agent-*.md` and adapt prompts
   to your project conventions.
2. Review `.flowai-workflow/workflow.yaml` for workflow structure.
3. Run `flowai-workflow run` to execute the first workflow.

## Available Templates

- `sdlc-claude` (default) — 6-agent SDLC workflow (PM → Architect →
  Tech Lead → Developer/QA loop → Tech Lead Review)
