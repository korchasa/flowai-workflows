<!-- section file — index: [documents/design-sdlc.md](../design-sdlc.md) -->

# SDS SDLC — Components: Trigger, Dashboard, Config Validation, CLI Help, JSDoc, AGENTS.md Validation


### 3.6 Pipeline Trigger

- **Purpose:** Single entry point for workflow. PM agent autonomously triages
  open GitHub issues.
- **Author constraint (FR-S31):** Only issues authored by `korchasa` are valid
  workflow inputs. Enforced in PM agent prompt (§3.4), not engine-level.
  Two enforcement points: `gh issue list --author` (triage) and
  `gh issue view --json author` (resume guard).
- **Interfaces:** CLI: `deno task run [--prompt "..."]`. PM selects
  highest-priority open issue via `gh`.
- **Deps:** Devcontainer, Claude CLI auth (OAuth or API key), `GITHUB_TOKEN`.

### 3.7 Dashboard Generator (`scripts/generate-dashboard.ts`) (FR-E18, FR-S16, FR-S19, FR-S20, FR-S26, issue #15, issue #93)

- **Purpose:** Generate self-contained HTML dashboard summarizing workflow run
  results. Reads `state.json` + per-node `logs/*.json`. Produces `index.html`
  in run directory with all CSS inlined (no CDN deps).
- **Functions:**
  - `readRunState(runDir)` — parse `state.json` → `RunState`
  - `readNodeLog(runDir, nodeId)` — parse `logs/<nodeId>.json` →
    `CliRunOutput`
  - `groupNodesByPhase(nodeIds, phases?)` — extract phase-grouping logic into
    standalone exported function (FR-S26). Signature:
    `groupNodesByPhase(nodeIds: string[], phases?: Record<string, string[]>): Array<{ label: string; ids: string[] }>`.
    Iterates `phases` entries, filters to nodes present in `nodeIds`, collects
    ungrouped nodes into `"other"` group. When `phases` absent/empty, returns
    single group with all `nodeIds` (empty label). Array return type preserves
    phase ordering by construction. Unit-tested independently (4 scenarios:
    phased grouping, unphased "other" group, empty nodeIds, no phases config).
  - `readStreamLog(path, maxHead?, maxTail?)` — reads `stream.log`, truncates
    if lines exceed `maxHead + maxTail` (defaults: 200, 50). Returns first
    `maxHead` lines + `--- truncated ---` marker + last `maxTail` lines. Empty
    string on missing file. Exported for unit testing (FR-S34)
  - `renderCard(nodeId, state, log, streamLogHref?, logContent?)` — HTML card:
    status badge, timing, cost, result summary via `<details><summary>` (first
    3 lines preview, full text in details body). Single-line results render
    without `<details>` wrapper. When `streamLogHref` provided: renders
    `<a class="log-link" href="${escHtml(streamLogHref)}">stream log</a>` after
    card-meta div. When `logContent` provided (FR-S34): renders inline
    `<details><summary>stream log</summary><pre class="log-content">
    ${escHtml(logContent)}</pre></details>` after link. `.log-content` CSS:
    monospace, max-height 400px, overflow-y scroll. Omitted when absent
    (backward-compatible)
  - `renderHtml(runDir, state, logs, streamLogHrefs?, logContents?,
    runOnAlwaysNodes?)` — full page: run metadata header, phase-grouped card
    grid, inlined CSS. Delegates phase-grouping to
    `groupNodesByPhase(Object.keys(state.nodes), phases)` — no inline
    phase-grouping logic remains. Single `groups.map()` path generates
    `<section>` HTML per group (collapses former if/else branch).
    `streamLogHrefs?: Record<string, string>` maps nodeId → relative href;
    `logContents?: Record<string, string>` maps nodeId → truncated log text
    (FR-S34); both threaded to each `renderCard()` call. Header status (FR-S34):
    `<strong class="${state.status}">` with distinct CSS per value — `completed`
    (green), `failed` (red), `aborted` (orange), `running` (blue). Phase
    aggregate status (FR-S34): each phase section header renders core-node
    aggregate badge + optional always-node badge via `computePhaseStatus()`.
    `runOnAlwaysNodes?: Set<string>` identifies always-nodes for separation
  - `computePhaseStatus(nodeIds, nodeStates, alwaysNodes)` — separates phase
    members into core (non-always) and always groups. Core status: all completed
    → "completed", any failed → "failed", else "running". Always-node status
    computed independently, returned as optional secondary value. Returns
    `{coreStatus: string, alwaysStatus?: string}`. Exported for unit testing
    (FR-S34)
  - `escHtml(str)` — escape `<>&"'` for XSS-safe HTML embedding
  - `computeTimeline(state: RunState)` — iterates `state.nodes`, parses
    `started_at` ISO timestamps, computes `offsetPct`/`widthPct` relative to
    run start/total duration. Identifies bottleneck (max `duration_ms`). Omits
    nodes with missing timing. Returns `{nodeId, offsetPct, widthPct,
    durationMs, isBottleneck}[]`
  - `renderTimeline(bars)` — generates Gantt-style HTML timeline section:
    container with relative positioning, bars absolutely-positioned per row
    (sorted by `started_at`). Bottleneck bar gets `.timeline-bottleneck` CSS
    class. Labels sanitized via `escHtml()`. Timeline CSS appended to existing
    `CSS` const (inlined, no CDN deps). Integrated into `renderHtml()` between
    header and card grid (FR-S19)
- **Stream log link flow (issue #15):** CLI entry point scans each node
  directory for `stream.log` existence via `Deno.stat()`. For nodes with phases,
  computes relative path as `<phase>/<nodeId>/stream.log`; without phase:
  `<nodeId>/stream.log`. Builds `Record<string, string>` href map, passes to
  `renderHtml()` → threaded to `renderCard()`. CSS: `.log-link` class (monospace,
  smaller font, muted color — distinct from result text).
- **Inline log content flow (FR-S34, issue #149):** CLI entry reads each
  `stream.log` via `readStreamLog()` (truncated to 200+50 lines). Builds
  `Record<string, string>` content map, passes to `renderHtml()` → threaded to
  `renderCard()`. Extracts `run_on` from workflow config nodes to build
  `Set<string>` of always-nodes, passed to `renderHtml()` for phase aggregate.
  Header status CSS: 4 distinct rules for `completed`/`failed`/`aborted`/
  `running`.
- **Functions (continued):**
  - `computeCostBars(state: RunState)` — filters `state.nodes` by
    `cost_usd > 0`, computes proportional `widthPct` relative to max cost.
    Returns `{nodeId: string, costUsd: number, widthPct: number}[]` (FR-S20)
  - `renderCostChart(bars, totalCost)` — inline SVG horizontal bar chart.
    Each bar: `<rect>` with proportional width, `<text>` label (node ID via
    `escHtml()`), cost value annotation. Total cost header. Empty bars →
    "No cost data" message (mirrors timeline empty-state). Cost chart CSS
    appended to `CSS` const. Integrated into `renderHtml()` between timeline
    and `<main>` card grid (FR-S20)
- **CLI help (FR-S26):** `printUsage()` static function outputs: description,
  usage line (`deno task dashboard --run-dir <path>`), options (`--run-dir`),
  examples. `--help`/`-h` → `printUsage()` + `Deno.exit(0)`. Unknown flags →
  error referencing `--help` + `Deno.exit(1)`. Follows `engine/cli.ts` format.
  Exported `printUsage()`/`checkArgs()` for unit testing
- **Interfaces:**
  - CLI: `deno task dashboard --run-dir <path>`
  - Hook: `after:` on `tech-lead-review` node via `run-dashboard.sh` wrapper
    (FR-S36 — replaces `|| true` with explicit warning logging)
- **Deps:** `engine/types.ts` (imports `RunState` and `CliRunOutput` — the
  latter re-exported from `@korchasa/ai-ide-cli/types`). No runtime engine
  dependency — reads JSON files directly.

### 3.8 Pipeline Config Validation (FR-S24)

- **Purpose:** Validate `.flowai-workflow/workflow.yaml` against engine schema as part
  of `deno task check`. Prevents config drift causing runtime failures.
- **Implementation:** `workflowIntegrity()` in `scripts/check.ts` delegates to
  engine's `loadConfig()` (`engine/config.ts`). The engine validation covers:
  - Node type validation (agent, merge, loop, human)
  - Required field validation per node type
  - `inputs` reference validation (referenced nodes must exist)
  - `run_on` enum validation
  - Loop body node validation
  - Phase configuration validation
  - Prompt file existence check
- **Validation flow:** `workflowIntegrity()` → `loadConfig()` →
  `validateSchema()` → `validateNode()` (per node). Errors thrown as exceptions
  with descriptive messages; `workflowIntegrity()` catches and reports.
- **Interfaces:** Called as part of `deno task check` sequence. No separate CLI
  entry point (deferred).
- **Deps:** `engine/config.ts` (`loadConfig` function).

### 3.8.1 HITL Artifact Source Validation (FR-S35)

- **Purpose:** Validate `defaults.hitl.artifact_source` uses `{{input.<node-id>}}`
  template syntax instead of a hardcoded path. Prevents silent breakage when
  specification node is renamed or artifact layout changes.
- **Implementation:** `hitlArtifactSource()` in `scripts/check.ts`:
  1. Loads workflow config via `loadConfig()`.
  2. Reads `config.defaults?.hitl?.artifact_source`.
  3. If field present and does not contain `{{input.`: reports error
     "hitl.artifact_source must use template syntax".
  4. If field absent: skips (no error).
- **Validation flow:** `hitlArtifactSource()` → `loadConfig()` → string match
  for `{{input.` → error collection → report. Pattern follows
  `workflowIntegrity()` (§3.8): catch + report, non-throwing.
- **Interfaces:** Called as part of `deno task check` sequence in
  `scripts/check.ts` main sequence, alongside `workflowIntegrity()` and
  `agentListAccuracy()`.
- **Deps:** `engine/config.ts` (`loadConfig` function).

### 3.9 SDLC Utility Scripts CLI Help (FR-S26)

- **Purpose:** `--help`/`-h` support for `scripts/self-runner.ts` and
  `scripts/loop-in-claude.ts`. Each script gets inline `printUsage()` following
  `engine/cli.ts` format (description, usage, options, examples).
- **`scripts/self-runner.ts`:** `printUsage()` describes workflow loop runner.
  Usage: `deno task loop [interval] [-- claude-args...]`. `--help`/`-h` →
  print + exit 0. Unknown `--`-prefixed flags → error + exit 1. Exported
  `printUsage()`/`checkArgs()` for unit testing.
- **`scripts/loop-in-claude.ts`:** `printUsage()` describes in-Claude workflow
  runner. Usage: `deno task loop-in-claude [claude-args...]`. `--help`/`-h`
  detected before passthrough to Claude CLI. Exported helpers for unit testing.
- **Pattern:** Identical to `engine/cli.ts`: static string, `Deno.args` scan,
  `Deno.exit(0)` on help, `Deno.exit(1)` on unknown flag with message
  referencing `--help`.

### 3.10 SDLC Script Module JSDoc (FR-S30)

- **Purpose:** Module-level `/** @module */` JSDoc coverage for all 4 SDLC
  utility scripts. Each module gets a docstring declaring purpose,
  responsibility, and dependencies.
- **Files:** `scripts/check.ts`, `scripts/claude-stream-formatter.ts`,
  `scripts/generate-dashboard.ts`, `scripts/self-runner.ts`.
- **Scope:** Module-level JSDoc only. Function-level JSDoc and why-comments
  excluded (covered by FR-E30 for engine modules only).
- **Deps:** None (documentation-only change).

### 3.11 AGENTS.md Agent List Validation (FR-S29)

- **Purpose:** Validate `AGENTS.md` lists exactly 6 active agents with no
  deprecated entries. Runs as part of `deno task check` alongside
  `workflowIntegrity()` (§3.8).
- **Implementation:** `agentListAccuracy()` in `scripts/check.ts`:
  1. Reads `AGENTS.md` content.
  2. Extracts agent list from Project Vision section (parenthetical list after
     "specialized AI agents").
  3. Verifies all 6 expected agents present: PM, Architect, Tech Lead,
     Developer, QA, Tech Lead Review.
  4. Verifies no deprecated agent names appear as active: Presenter, Reviewer,
     SDS Update, Meta-Agent.
  5. Reports pass/fail with descriptive messages per check.
- **Validation flow:** `agentListAccuracy()` → `Deno.readTextFile("AGENTS.md")`
  → string matching against expected/deprecated lists → error collection →
  report. Pattern follows `workflowIntegrity()`: catch + report, non-throwing.
- **Interfaces:** Called as part of `deno task check` sequence in
  `scripts/check.ts` main sequence. No separate CLI entry point.
- **Deps:** None (reads `AGENTS.md` directly, no engine dependency).


