<!-- section file — index: [documents/design-engine.md](../design-engine.md) -->

# SDS Engine — Engine Modules (types, template, config, dag, validate, state, runtime, agent)


## 3. Components

### 3.1 Workflow Engine (`engine/`)

- **Purpose:** Configurable DAG-based workflow executor. Replaces hardcoded
  shell script orchestration with YAML-driven node graph.
- **Modules:**
  - `types.ts` — type declarations (incl. `ValidationRule.type` union
    (`"artifact"` added — FR-E33: composite rule with `sections?: string[]`;
    `"scope_check"` added — FR-E37: internal-only, engine auto-injects when
    `allowed_paths` present, not user-configured in YAML),
    `NodeConfig.allowed_paths` (`string[]`, optional — FR-E37: glob patterns
    defining allowed file modifications for scope-based detection),
    `NodeConfig.run_on` (`"always"|"success"|"failure"`), `NodeConfig.phase`,
    `NodeConfig.env`, `NodeConfig.model` (per-node runtime model override),
    `NodeConfig.runtime`, `NodeConfig.runtime_args`,
    `WorkflowDefaults.model` (default model for all nodes),
    `WorkflowDefaults.runtime`, `WorkflowDefaults.runtime_args`,
    `LoopNodeConfig.nodes` (inline body node definitions),
    `LoopResult.bodyResults`, `ErrorCategory` (structured failure enum),
    `NodeState.error_category`, `NodeState.cost_usd` (FR-E17 per-node cost),
    `RunState.total_cost_usd` (FR-E17 aggregated run cost),
    `WorkflowDefaults.on_failure_script` (FR-E19 configurable failure hook),
    `WorkflowDefaults.prepare_command` (FR-E30 post-config/pre-node shell hook),
    `HitlConfig.artifact_source` (renamed from `issue_source`),
    `HitlConfig.exclude_login` (renamed from `bot_login`),
    `Verbosity` union: `"quiet"|"normal"|"semi-verbose"|"verbose"` (FR-E21))
  - `template.ts` — `{{var}}` interpolation for prompts/paths.
    `resolve()` handles `file("path")` pattern within `{{...}}` matches
    (FR-E32): detects `/^file\("(.+)"\)$/`, reads file via
    `Deno.readTextFileSync()` relative to `Deno.cwd()`, returns content
    as-is (no re-interpolation — single-pass). Missing file → throw with
    diagnostic. Size > `FILE_INCLUSION_SIZE_WARN_BYTES` (100KB) →
    `console.warn()` (non-fatal).
    `validateTemplateVars(template: string, knownInputs: string[]): string[]`
    (FR-E7): extracts all `{{...}}` patterns, validates each against known
    prefixes (`input` — suffix ∈ `knownInputs`, `env`, `args`, `loop` —
    only `loop.iteration`) and direct keys (`run_dir`, `run_id`, `node_dir`).
    `file("...")` accepted. Unknown prefix/key → error string. Returns error
    array (empty = valid). Pure function, no I/O. Co-located with `resolve()`
    to maintain single source of truth for valid template variables
  - `config.ts` — YAML parsing, schema validation, defaults merge,
    `run_on` normalization. `extractWorktreeDisabled()`: lightweight pre-parse
    extracting only `defaults.worktree_disabled` for two-phase loading (FR-E24). `validateNode()`: if `run_on` present, must be
    one of `"always"|"success"|"failure"`; error:
    `Node '<id>' has invalid run_on value '<val>'. Must be one of: always, success, failure`.
    `validateFileReferences(config)` (FR-E32): scans all `task_template`
    and `prompt` fields (incl. loop body nodes) for `{{file("...")}}` regex,
    checks file existence via `Deno.statSync()`. Skips paths containing `{{`
    (unresolvable at load time). Called from `mergeDefaults()` alongside
    `validatePromptPaths()`.
    **Hook template variable validation (FR-E7):** In `validateNode()`, after
    existing type-specific checks: calls `validateTemplateVars()` (imported
    from `template.ts`) on `node.before` and `node.after` strings. Passes
    `allNodeIds` as `knownInputs` (for top-level nodes) or
    `[...allNodeIds, ...bodyNodeIds]` (for loop body nodes — can reference
    both external and sibling nodes). Errors formatted with hook type
    (`before`/`after`) and node ID. Non-empty errors → config validation
    error at load time (fail-fast).
    `validateAllowedPaths()` (FR-E37): when `allowed_paths` present on node,
    validates array of non-empty strings. Invalid → config error at parse time.
    Called from `validateNode()`.
    `validateValidationRule()` (FR-E33, FR-E38): `"artifact"` added to
    `validTypes`. When `type === "artifact"`: at least one of `sections` or
    `fields` required (both optional individually). `sections` validated as
    non-empty string array when present. `fields` validated as non-empty
    string array (no empty strings) when present. Missing both → config error.
    Invalid entries → config error at parse time.
    **Phase mutual-exclusivity validation (FR-E33):** After existing `phases:`
    block structure validation (~line 128), new pass iterates all nodes checking
    for `phase:` field while `config.phases` is defined. If both mechanisms
    detected: throws diagnostic error naming both mechanisms and ≥1 affected
    node ID. Format: `"Config uses both 'phases' block and per-node 'phase'
    field (node '<id>'). Use one mechanism only."`. Runs in `mergeDefaults()`
    alongside existing validation passes.
    `normalizeRunOn()` pass (in `mergeDefaults()`):
    if `node.run_always === true && !node.run_on` → sets `run_on = "always"`;
    if both present, `run_on` wins; deletes `run_always` from config
    post-normalization (downstream code only sees `run_on`).
    Loop nodes: parses `nodes` sub-object, validates body node ordering
    (>1 entry requires `inputs` declarations), validates `condition_node`
    references valid key in `nodes`. Skips top-level existence check for
    body node IDs referenced in `inputs`.
    **Loop input forwarding validation (FR-E35):** After body node validation
    loop (~line 261-271), iterates each body node's `inputs`. For each input
    NOT in `bodyNodeIds` (external reference), checks presence in
    `node.inputs ?? []` (loop node's declared inputs). Missing → throws:
    `"Loop '<loopId>' body node '<bodyId>' references external input(s)
    [<missing>] not listed in loop inputs"`. Runs inline in `validateNode()`
    loop branch — no new function or signature change. `node.inputs` accessed
    directly from the loop node object already in scope.
    **Loop condition_field validation (FR-E36):** After FR-E35 input forwarding
    check, inspects condition node's `validate` array for a `frontmatter_field`
    rule whose `field` matches `condition_field`. If condition node HAS a
    `validate` block but NO matching `frontmatter_field` rule → throws:
    `"Loop '<id>' condition_field '<field>' is not declared as a
    frontmatter_field in condition node '<condId>' validate block"`. If
    condition node has no `validate` block at all → skip (no contract to
    enforce). Inline in `validateNode()` loop branch — consistent with FR-E35
    pattern. No new function or signature change.
  - `dag.ts` — topological sort, cycle detection, level grouping.
    Excludes loop body nodes (from `nodes` sub-object) from top-level
    graph; loop node itself remains in DAG with its declared `inputs`.
  - `validate.ts` — artifact validation rules (file_exists, not_empty,
    contains_section, custom_script, frontmatter_field, artifact).
    `checkArtifact(path, sections, fields)` (FR-E33, FR-E38): self-contained
    private function. Stat → read → heading-regex loop → field-presence check
    → aggregate. Fail-fast order: absent file → empty file → missing sections
    → missing/empty fields. All missing sections collected into one aggregate
    `ValidationResult`. Heading regex duplicated from `checkContainsSection()`
    (~1 line) — intentional. Frontmatter field presence: parse frontmatter via
    `^---\n([\s\S]*?)\n---` regex (same approach as `checkFrontmatterField`),
    extract key-value pairs, check each `fields` entry exists with non-empty
    value. Missing/empty fields aggregated into single error. Regex duplication
    intentional — distinct semantic context (presence-only vs value-constraint)
  - `state.ts` — RunState persistence to `state.json`, resume logic,
    phase registry (`setPhaseRegistry()`, `getPhaseForNode()`,
    `clearPhaseRegistry()` — see §3.2),
    cost aggregation (`updateRunCost()` sums
    `nodes[*].cost_usd` → `total_cost_usd`; called from
    `markNodeCompleted()` when optional `costUsd` param provided, FR-E17).
    `markNodeCompleted()` also accepts optional `result?: string` param
    (FR-E22) — persists excerpt to `NodeState.result` in `state.json`
  - **IDE CLI wrapper layer (FR-E44)** — extracted to
    `@korchasa/ai-ide-cli` (sibling workspace member `ai-ide-cli/`, published
    separately on JSR). Runtime adapters, low-level Claude/OpenCode
    runners, Claude stream parser, OpenCode HITL MCP helper, and pure
    process registry all live in that package. Engine imports via
    sub-path specifiers (e.g. `@korchasa/ai-ide-cli/runtime`,
    `@korchasa/ai-ide-cli/claude/process`) and owns only workflow-level
    concerns. Library has zero imports from engine (one-way dependency
    invariant — guarded by `rg` in Step 11 of the migration plan).
  - `@korchasa/ai-ide-cli/runtime` — runtime adapters and capability
    metadata. `runtime/index.ts` exposes `getRuntimeAdapter(id)` and
    `resolveRuntimeConfig({defaults, node, parent})` (node > parent >
    defaults precedence). `resolveRuntimeConfig` takes a library-local
    `RuntimeConfigSource` shape so engine's `NodeConfig` /
    `WorkflowDefaults` structurally satisfy it without the library
    depending on workflow types. `runtime/claude-adapter.ts` wraps
    `claude/process.ts` (`permissionMode=true`, `hitl=true`,
    `transcript=true`). `runtime/opencode-adapter.ts` wraps
    `opencode/process.ts` (`permissionMode=true`, `hitl=true`,
    `transcript=false`). Normalized output shape `CliRunOutput`
    (runtime-neutral rename of former `ClaudeCliOutput`) carries
    `result`, `session_id`, `total_cost_usd`, `duration_ms`,
    `duration_api_ms`, `num_turns`, `is_error`, optional
    `permission_denials`, `hitl_request`, `runtime`.
  - `agent.ts` — runtime-agnostic agent invocation, continuation loop, retry.
    Agent context injected via `--agent` + `--append-system-prompt` (native
    Claude Code subagents in `.claude/agents/*.md`). Pipeline-specific context
    via `task_template` `{{file(...)}}` (FR-S38). Base system prompt preserved.
    Runtime resolution is centralized in `@korchasa/ai-ide-cli/runtime`;
    `runAgent()` resolves the adapter once and keeps continuation semantics
    unchanged across runtimes. `AgentRunOptions.model`: optional string for
    per-node model selection. For Claude, `buildClaudeArgs()` (from
    `@korchasa/ai-ide-cli/claude/process`) emits `--model <value>` only on
    fresh invocations (resume inherits model from session). For OpenCode,
    the runner at `@korchasa/ai-ide-cli/opencode/process` emits
    `run --model <provider/model>` on fresh invocations and resumes
    sessions with `run --session <id>`. `runAgent()` wires
    `hitlMcpCommandBuilder` from `engine/hitl-mcp-command.ts` so the
    OpenCode runner can self-spawn the engine binary for the stdio MCP
    HITL helper.
    **Permission mode (FR-E40):** `PermissionMode` union type in `types.ts`
    with 6 values matching Claude CLI `--permission-mode` flag. Optional field
    on `WorkflowDefaults` and `NodeConfig`. Resolution cascade:
    `node.permission_mode → config.defaults.permission_mode → omit`.
    `buildClaudeArgs()` emits `--permission-mode <value>` when set.
    `DEFAULT_WORKFLOW_DEFAULTS` uses `Omit<WorkflowDefaults, "permission_mode">`
    to keep field absent by default (no empty-string sentinel).
    Config validation in `validateSchema()`: rejects invalid values via
    `VALID_PERMISSION_MODES` constant; conflict detection throws if
    `claude_args` contains `--dangerously-skip-permissions` or
    `--permission-mode` while `permission_mode` field is also set. Effective
    `opencode` agent nodes reject `permission_mode` at config-load time.
    Threaded through: `AgentRunOptions`, `ClaudeInvokeOptions`, `HitlBaseParams`,
    `HitlRunOptions` — all accept optional `permissionMode?: string`.
    `executeClaudeProcess()` uses `--output-format stream-json` and reads
    stdout line-by-line. Each JSON line appended to `streamLogPath` file
    (crash-resilient incremental write via `Deno.writeFile({ append: true })`).
    **Stream log timestamps (FR-E18):** `tsPrefix()` returns `[HH:MM:SS]`
    wall-clock prefix; `stampLines()` prepends it to each non-empty line (empty
    lines pass through). Applied to log file writes only — terminal output via
    `onOutput` callback receives raw text without timestamps.
    On `result` event: extracts `CliRunOutput` fields (`result`,
    `session_id`, `is_error`, `total_cost_usd`, `duration_ms`,
    `duration_api_ms`, `num_turns`, `permission_denials`). `is_error` derived
    from `subtype !== "success"`. No `result` event → throws descriptive error.
    `streamLogPath` accepted as required parameter in `executeClaudeProcess()`.
    Append semantics: multiple invocations (continuation) with same path
    produce concatenated JSONL. `--verbose` flag removed from
    `buildClaudeArgs()` (unrelated to streaming, changes stderr globally).
  - `@korchasa/ai-ide-cli/opencode/process` — low-level
    `opencode run --format json` runner (formerly
    `engine/opencode-process.ts`). Parses NDJSON events (`step_start`,
    `text`, `step_finish`, `error`), normalizes them into
    `CliRunOutput`-compatible shape, and supports generic runtime
    extension flags via `runtime_args` (for example `--variant high`).
    OpenCode has no dedicated system-prompt flag, so the adapter prepends
    `system_prompt` content to the task prompt before invocation. When
    `hitlConfig` is set, the runner injects a per-invocation local MCP
    server through `OPENCODE_CONFIG_CONTENT`; the MCP sub-process `argv`
    comes from the consumer-provided
    `RuntimeInvokeOptions.hitlMcpCommandBuilder` callback — the library
    ships no binary and throws a clear error if `hitlConfig` is set
    without a builder. The engine supplies the builder via
    `engine/hitl-mcp-command.ts`, pointing at engine's own `cli.ts`
    (`--internal-opencode-hitl-mcp`). The injected server exposes
    `request_human_input`, surfaced in stream events as
    `hitl_request_human_input`. The parsed stream is normalized into the
    same output shape consumed elsewhere by state, continuation, and log
    code (`CliRunOutput` + optional `hitl_request`).
    **Repeated file read warning (FR-E20):** `FileReadTracker` class in
    `agent.ts`. `track(path): string | null` — maintains `Map<string, number>`,
    returns `[WARN] repeated file read: <path> (<N> times)` when count >
    threshold (default 2), else null. Instantiated per `executeClaudeProcess()`
    call (counter resets per invocation). In event loop: for `tool_use` blocks
    with `name === "Read"`, calls `tracker.track(block.input.file_path)`. Non-
    null result written to `logFile` via `stampLines()`. Log-file-only (terminal
    `onOutput` unchanged). Pure-logic class — unit-testable without I/O.
    **Turn separators and summary footer (FR-S20):** `executeClaudeProcess()`
    maintains `turnCount` counter. On each `event.type === "assistant"`:
    increments counter, writes `--- turn N ---` line to `logFile` via
    `stampLines()` (timestamped, consistent with existing log writes). After
    `result` event extraction: writes `--- end ---` + one-line summary via
    `formatFooter(output: CliRunOutput): string`. Footer format:
    `status=<ok|error> duration=<X>s cost=$<Y> turns=<N>`. Both separators and
    footer are log-file-only (terminal `onOutput` callback unchanged).
    `formatFooter()` is a pure function — unit-testable without CLI.
    **Stream event processor extraction (FR-E30):** `processStreamEvent(event,
    state): Promise<void>` — extracted helper consolidating duplicated event-
    processing logic from main loop and buffer-remainder block in
    `executeClaudeProcess()`. Receives parsed JSON event + mutable
    `StreamProcessorState` bag (`turnCount`, `resultEvent`, `tracker:
    FileReadTracker`, `logFile`, `encoder`, `onOutput?`, `verbosity?`).
    Performs: turn counting + separator writing, file-read tracking (warns on
    repeated reads), result event extraction, log file writes via `stampLines()`,
    footer generation via `formatFooter()`, terminal output forwarding via
    `onOutput` callback (with optional semi-verbose filtering). Both call sites
    in `executeClaudeProcess()` reduce to: parse JSON → `await
    processStreamEvent(parsed, state)`. Net ~40-line reduction. Pure-ish
    function — unit-testable with synthetic events, no CLI spawn.
    **Repeated file read warning (FR-S20):** `executeClaudeProcess()` maintains
    `readCounts: Map<string, number>` tracking per-path `Read` tool-use events.
    On each `assistant` event: iterates `message.content` blocks, detects
    `tool_use` with `name === "Read"`, extracts `input.file_path`, increments
    count. When count > 2: writes warning to `logFile` via `stampLines()`.
    `checkRepeatedRead(readCounts, filePath): string | null` — helper: increments
    map, returns formatted warning when count > 2, else null.
    `formatRepeatedReadWarning(path, count): string` — pure function returning
    `[WARN] repeated file read: <path> (<N> times)`. Exported for unit testing.
    Warning is log-only (no `onOutput` callback). Counters reset per invocation
    (map is local to `executeClaudeProcess()` call). Execution not blocked.
    **Semi-verbose filtering (FR-E21):** `formatEventForOutput(event,
    verbosity?)` accepts optional `Verbosity` param. When
    `verbosity === "semi-verbose"`, skips `tool_use` content blocks in
    `assistant` events — emits only `text` blocks. Default `undefined` =
    all blocks (backward-compatible). Log file writes call without verbosity
    (full output preserved). `onOutput` callback path passes verbosity from
    `AgentRunOptions` so terminal output is filtered at source

