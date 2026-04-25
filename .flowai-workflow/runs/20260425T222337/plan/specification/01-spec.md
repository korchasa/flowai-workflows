---
issue: 196
scope: engine
---

## Problem Statement

Claude CLI checks for and applies updates at startup by default. The engine
spawns one fresh `claude` process per agent node (and per continuation/resume
turn). In a long-running workflow this creates a window where early nodes run
on version X and later nodes on version Y — different system prompts, tool
descriptions, behavior — with no operator visibility. Setting
`DISABLE_AUTOUPDATER=1` in the spawn environment reliably prevents the CLI
from self-updating for the lifetime of each spawned process, eliminating a
source of silent non-reproducibility.

Capturing `claude --version` once at run start and storing it in `RunState`
gives operators a verifiable record of which CLI version ran.

## Affected Requirements

- **FR-E49** (new): Spawn-time CLI Version Pinning. Engine always injects
  `DISABLE_AUTOUPDATER=1` in Claude CLI spawn env; captures `claude --version`
  at run start into `RunState.claude_cli_version`.

No existing FRs are modified. The new requirement is additive to the runtime
spawn path already established by FR-E24 (Worktree Isolation) and FR-E40
(Permission Mode), which similarly inject engine-controlled values into spawn
parameters.

## SRS Changes

- **New:** FR-E49 (Spawn-time CLI Version Pinning) added to
  `documents/requirements-engine/04-runtime-and-hooks.md`.
- **Updated:** `documents/requirements-engine.md` index — FR-E49 row added to
  FR-E ID → Section File table; section description for 04-runtime-and-hooks
  updated to mention spawn-time CLI version pinning.

## Scope Boundaries

**In scope:**
- `DISABLE_AUTOUPDATER=1` injected on every Claude CLI spawn path (initial,
  continuation, resume).
- Single env builder function used by all spawn sites (no independent env
  construction).
- `RunState.claude_cli_version` field + one-time version capture at run start.
- Unit tests for env builder behavior.

**Out of scope (per issue):**
- Pinning a specific CLI version across runs (deployment concern, not engine).
- Blocking the user from running `claude update` outside the engine.
- Version compatibility checks between runs.
- Applying `DISABLE_AUTOUPDATER=1` to non-Claude runtimes (OpenCode, Codex).
- SDS (`design-engine.md`) update — that is an Architect/Tech Lead concern.

## Summary

Selected issue #196 (engine: Pin Claude CLI version per run via
DISABLE_AUTOUPDATER=1). Added FR-E49 to `04-runtime-and-hooks.md` covering
env injection, unified spawn builder, `RunState.claude_cli_version` capture,
and unit tests. Updated the SRS index to register FR-E49. Out-of-scope:
cross-run version pinning, non-Claude runtime support, SDS changes.
