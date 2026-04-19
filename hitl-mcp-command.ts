/**
 * @module
 * Engine-local helper that produces the `argv` used to spawn the stdio MCP
 * HITL server. Consumed by `@korchasa/ai-ide-cli/opencode/process` through the
 * `RuntimeInvokeOptions.hitlMcpCommandBuilder` callback.
 *
 * The spawned sub-process is the engine binary itself with the
 * `--internal-opencode-hitl-mcp` flag; `engine/cli.ts` dispatches that flag
 * to `runOpenCodeHitlMcpServer()`. Running in dev mode (`deno run ...`) the
 * helper prepends `deno run -A` and points at this package's `./cli.ts`;
 * running from a compiled binary it spawns the binary directly.
 */

import { basename, fromFileUrl } from "@std/path";
import { INTERNAL_OPENCODE_HITL_MCP_ARG } from "@korchasa/ai-ide-cli/opencode/hitl-mcp";

/** Build the `argv` for spawning the OpenCode HITL MCP sub-process. */
export function buildEngineHitlMcpCommand(): string[] {
  const execPath = Deno.execPath();
  const execName = basename(execPath).toLowerCase();

  if (execName === "deno" || execName.startsWith("deno.")) {
    return [
      execPath,
      "run",
      "-A",
      fromFileUrl(new URL("./cli.ts", import.meta.url)),
      INTERNAL_OPENCODE_HITL_MCP_ARG,
    ];
  }

  return [execPath, INTERNAL_OPENCODE_HITL_MCP_ARG];
}
