/**
 * @module
 * Signal-handler wiring for the engine. Delegates process tracking and
 * shutdown callback management to `@korchasa/ai-ide-cli/process-registry`;
 * owns only the OS-level SIGINT/SIGTERM plumbing that translates signals
 * into a graceful `killAll()` + `Deno.exit(130|143)` sequence.
 */

import {
  _getProcesses,
  _getShutdownCallbacks,
  _reset as _resetLib,
  killAll,
  onShutdown,
  register,
  unregister,
} from "@korchasa/ai-ide-cli/process-registry";

// Re-export the pure library API so existing engine callers keep working
// through `engine/process-registry.ts`.
export {
  _getProcesses,
  _getShutdownCallbacks,
  killAll,
  onShutdown,
  register,
  unregister,
};

// Signal-listener state is engine-local because installation/removal of
// OS signal listeners is a host-process concern the library doesn't own.
let sigintListener: (() => void) | null = null;
let sigtermListener: (() => void) | null = null;
let handlersInstalled = false;
let shuttingDown = false;

/**
 * Install SIGINT + SIGTERM handlers. Idempotent — only installs once.
 * On signal: calls {@link killAll}, then `Deno.exit(130 for SIGINT, 143 for SIGTERM)`.
 */
export function installSignalHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;

  const handler = (signal: Deno.Signal) => {
    if (shuttingDown) return; // Prevent re-entrant shutdown
    shuttingDown = true;
    const code = signal === "SIGINT" ? 130 : 143;
    killAll().finally(() => {
      Deno.exit(code);
    });
  };

  sigintListener = () => handler("SIGINT");
  sigtermListener = () => handler("SIGTERM");

  try {
    Deno.addSignalListener("SIGINT", sigintListener);
  } catch {
    // Signal may not be available (e.g. Windows)
  }
  try {
    Deno.addSignalListener("SIGTERM", sigtermListener);
  } catch {
    // Signal may not be available
  }
}

// --- Test helpers (prefixed with _ to indicate internal use) ---

/** Reset all state including signal listeners. For test isolation only. */
export function _reset(): void {
  _resetLib();
  if (sigintListener) {
    try {
      Deno.removeSignalListener("SIGINT", sigintListener);
    } catch { /* ignore */ }
    sigintListener = null;
  }
  if (sigtermListener) {
    try {
      Deno.removeSignalListener("SIGTERM", sigtermListener);
    } catch { /* ignore */ }
    sigtermListener = null;
  }
  handlersInstalled = false;
  shuttingDown = false;
}
