/**
 * @module
 * Engine-managed environment helpers for subprocess spawning.
 * Builds the env override record applied at engine startup and captures
 * the claude CLI version for state persistence (FR-E49).
 */

/** Returns engine-mandated environment variable overrides.
 * Applied via Deno.env.set() at engine startup so all child processes inherit them. */
export function buildEngineEnv(): Record<string, string> {
  return {
    DISABLE_AUTOUPDATER: "1",
  };
}

/** Captures the claude CLI version string by running `claude --version`.
 * Throws on non-zero exit — version capture is non-optional (FR-E49).
 * @param cwd — working directory for the subprocess; defaults to CWD. */
export async function captureCliVersion(cwd?: string): Promise<string> {
  const proc = new Deno.Command("claude", {
    args: ["--version"],
    stdout: "piped",
    stderr: "piped",
    ...(cwd ? { cwd } : {}),
  });
  const result = await proc.output();
  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(`claude --version failed: ${stderr}`);
  }
  return new TextDecoder().decode(result.stdout).trim();
}
