#!/usr/bin/env -S deno run --no-check

/**
 * Pre-Tool-Use hook for Bash: blocks direct `deno fmt|lint|test` invocations
 * and steers the agent to `deno task check` instead.
 *
 * Reads the Claude Code hook JSON envelope from stdin, parses
 * `tool_input.command`, and exits 0 (allow) or 2 (block + stderr message).
 *
 * Reasoning is pure (see {@link shouldBlock}); the I/O wrapper at the
 * bottom of the file is the only impure part. Tests cover the pure
 * function via direct import — no subprocess spawning required.
 */

/** Decision returned by {@link shouldBlock}. `block: true` means the
 * agent's bash command must NOT run; `reason` is shown on stderr. */
export interface GuardDecision {
  block: boolean;
  reason?: string;
}

/** Commands whose first tokens carry message bodies as DATA. A literal
 * `deno fmt|lint|test` inside a commit message, PR body, or release note
 * is prose, not an invocation — exit early without scanning. Without
 * this, the strict regex below false-positived ~10% of `git commit -m`
 * calls historically. */
const DATA_PASSING_PREFIXES: readonly string[] = [
  "git commit ",
  "git tag ",
  "gh pr ",
  "gh issue ",
  "gh release ",
];

/** Commands whose first token EXECUTES its (possibly quoted) argument
 * string. We need to peek INSIDE the quoted payload to detect a real
 * `deno test` invocation; for other commands quotes are a real DATA
 * boundary and must be preserved. */
const SHELL_INTERPRETERS: ReadonlySet<string> = new Set([
  "bash",
  "sh",
  "zsh",
  "eval",
]);

/** Real `deno (lint|fmt|test)` invocation: `deno` at command position
 * (start, after whitespace, or after a shell connector) and the verb
 * followed by whitespace or end-of-string. */
const DIRECT_PATTERN = /(^|\s|&&|\|\||;)deno\s+(lint|fmt|test)(\s|$)/;
/** Whitelisted form: `deno task <name>` is always allowed. */
const TASK_PATTERN = /(^|\s|&&|\|\||;)deno\s+task\s/;

/** Block message shown to the agent on stderr when {@link shouldBlock}
 * returns `block: true`. Stable wording — agents may pattern-match on it. */
export const BLOCK_REASON =
  "BLOCKED: Direct 'deno lint/fmt/test' is not allowed. Use 'deno task check' instead.";

/**
 * Decide whether a bash command must be blocked.
 *
 * Logic:
 * 1. Empty/whitespace command → allow (no-op).
 * 2. Command starts with a known data-passing prefix (`git commit`,
 *    `gh pr`, etc.) → allow without scanning.
 * 3. Command's first token is a shell-interpreter (`bash`, `sh`, `zsh`,
 *    `eval`) → strip ALL quote characters (single and double) so that
 *    `bash -c "deno test"` collapses to `bash -c  deno test` and the
 *    inner verb is exposed as a bare token at command position.
 * 4. Otherwise → scan the raw command. Quotes in raw form act as a
 *    data boundary, so `echo "deno fmt is bad"` is correctly allowed.
 * 5. If a direct invocation is detected and it is NOT `deno task ...`,
 *    block.
 *
 * Pure function — same input, same output. No I/O, no globals.
 */
export function shouldBlock(command: string): GuardDecision {
  const cmd = command.trim();
  if (cmd === "") return { block: false };

  for (const prefix of DATA_PASSING_PREFIXES) {
    if (cmd.startsWith(prefix)) return { block: false };
  }

  const firstToken = cmd.split(/\s+/, 1)[0];
  const scan = SHELL_INTERPRETERS.has(firstToken)
    ? cmd.replaceAll(/['"]/g, "")
    : cmd;

  if (DIRECT_PATTERN.test(scan) && !TASK_PATTERN.test(scan)) {
    return { block: true, reason: BLOCK_REASON };
  }
  return { block: false };
}

/** Read the entire stdin stream as a UTF-8 string. */
async function readStdin(): Promise<string> {
  return await new Response(Deno.stdin.readable).text();
}

/** Hook entry: parse JSON envelope, decide, exit. Fail-safe: on any
 * parse error, allow the command (the hook must not break the agent). */
async function main(): Promise<void> {
  const body = await readStdin();
  let envelope: { tool_input?: { command?: unknown } };
  try {
    envelope = JSON.parse(body);
  } catch {
    Deno.exit(0);
  }
  const command = typeof envelope?.tool_input?.command === "string"
    ? envelope.tool_input.command
    : "";
  const decision = shouldBlock(command);
  if (decision.block) {
    if (decision.reason) console.error(decision.reason);
    Deno.exit(2);
  }
  Deno.exit(0);
}

if (import.meta.main) {
  await main();
}
