---
variant: "Variant A: Inline FileReadTracker class in agent.ts"
tasks:
  - desc: "Add FileReadTracker class with track() method and threshold logic"
    files: ["engine/agent.ts", "engine/agent_test.ts"]
  - desc: "Wire FileReadTracker into executeClaudeProcess() event loop"
    files: ["engine/agent.ts", "engine/agent_test.ts"]
---

## Justification

**Variant A selected** over B (standalone module) and C (functional inline).

- **SRS/SDS alignment:** FR-39 specifies `FileReadTracker` class in
  `engine/agent.ts` by name. Variant A is the only option that matches spec
  exactly. Variant B deviates (new module), Variant C deviates (no class).
- **Vision alignment (AGENTS.md):** Project vision emphasizes stateless agents
  with observability. FileReadTracker is an observability feature (log-file
  warning) that helps Meta-Agent diagnose wasteful agent behavior — directly
  supporting autonomous pipeline optimization without human gates.
- **Complexity trade-off:** S effort, ~30 lines added to a 660-line file.
  Class is tightly coupled to `executeClaudeProcess()` internals (event
  parsing, `logFile`, `stampLines()`). Extracting to a separate module (B)
  creates unnecessary indirection for a single-use feature. Functional inline
  (C) sacrifices unit testability.
- **Testability:** Exported class enables direct unit tests for threshold
  boundary, per-path independence, warning format — without simulating full
  event streams.

**Rejected:**
- **Variant B:** Over-engineering. New module for ~25 lines of logic.
  Additional import surface. SDS explicitly specifies class in `agent.ts`.
- **Variant C:** `checkRead()` is private to `executeClaudeProcess()`, not
  directly unit-testable. Deviates from SRS class name requirement.

**Note:** SDS has FR numbering conflict (turn separators labeled FR-39 in SDS
vs repeated file read labeled FR-39 in SRS). Out of scope for this task — SDS
update below uses FR-40 label for repeated file read to avoid collision.

## Task Descriptions

### Task 1: Add FileReadTracker class with track() method and threshold logic

Create exported `FileReadTracker` class in `engine/agent.ts`:
- Internal `Map<string, number>` for per-path read counts
- `track(path: string): string | null` — increments count, returns warning
  string when count > 2 (threshold), null otherwise
- Warning format: `[WARN] repeated file read: <path> (<N> times)`
- Write unit tests: threshold boundary (2→null, 3→warning), per-path
  independence, warning format with correct count, multiple paths

### Task 2: Wire FileReadTracker into executeClaudeProcess() event loop

Integrate tracker into `executeClaudeProcess()`:
- Instantiate `FileReadTracker` at top of function, before event loop
- In event loop: on `assistant` events, iterate `message.content` blocks,
  detect `tool_use` with `name === "Read"`, call `tracker.track(input.file_path)`
- Write non-null warnings to `logFile` via `stampLines()` (log-file-only,
  no `onOutput` callback)
- Integration test: simulate stream events with repeated reads, verify
  warnings appear in log file output
