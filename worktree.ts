/**
 * @module
 * Git worktree lifecycle management for per-run isolation.
 * Each workflow run executes in its own worktree, eliminating destructive
 * `git reset --hard` and enabling future parallel runs.
 */

/** Base directory for worktrees (relative to original repo root). */
const WORKTREE_BASE = ".flowai-workflow/worktrees";

/** Get the worktree path for a given run ID (relative to repo root). */
export function getWorktreePath(runId: string): string {
  return `${WORKTREE_BASE}/${runId}`;
}

/**
 * Create a git worktree for a workflow run.
 * 1. Fetches latest from origin (fail fast on network error).
 * 2. Creates worktree at `.flowai-workflow/worktrees/<runId>` from `ref`.
 * Returns the relative worktree path.
 */
export async function createWorktree(
  runId: string,
  ref = "origin/main",
): Promise<string> {
  // Fetch latest
  await runGit(["fetch", "origin", "main"], "git fetch origin main failed");

  const worktreePath = getWorktreePath(runId);

  // Create worktree (detached HEAD from ref)
  await runGit(
    ["worktree", "add", "--detach", worktreePath, ref],
    `git worktree add failed for ${worktreePath}`,
  );

  return worktreePath;
}

/**
 * Remove a git worktree. Swallows NotFound errors (idempotent).
 * Uses --force to handle dirty worktrees (artifacts may have been written).
 */
export async function removeWorktree(worktreePath: string): Promise<void> {
  try {
    await runGit(
      ["worktree", "remove", "--force", worktreePath],
      `git worktree remove failed for ${worktreePath}`,
    );
  } catch (err) {
    // Swallow if worktree doesn't exist
    if (
      err instanceof Error &&
      (err.message.includes("is not a working tree") ||
        err.message.includes("No such file or directory"))
    ) {
      return;
    }
    throw err;
  }
}

/** Check if a worktree directory exists for the given run ID. */
export function worktreeExists(runId: string): boolean {
  try {
    const info = Deno.statSync(getWorktreePath(runId));
    return info.isDirectory;
  } catch {
    return false;
  }
}

/**
 * Copy a file from workDir to the original repo (relative paths).
 * Used to persist state.json to original repo before worktree removal.
 */
export async function copyToOriginalRepo(
  workDir: string,
  relativePath: string,
): Promise<void> {
  const src = `${workDir}/${relativePath}`;
  // Ensure destination directory exists
  const destDir = relativePath.substring(0, relativePath.lastIndexOf("/"));
  if (destDir) {
    await Deno.mkdir(destDir, { recursive: true });
  }
  await Deno.copyFile(src, relativePath);
}

/**
 * Pin a detached HEAD in `workDir` to a fresh rescue branch (FR-E51).
 *
 * Worktrees are created with `--detach` (FR-E24), so commits made during a
 * run are reachable only via the worktree's HEAD. After `removeWorktree`
 * those commits become unreachable and eligible for git gc. This function
 * snapshots HEAD into a named branch BEFORE removal so the work survives.
 *
 * Returns the rescue branch name, or `undefined` when HEAD is already on a
 * named branch (no rescue needed). Branch name is
 * `flowai/run-<runId>-orphan-rescue`; if that name already exists (resume
 * of the same run-id, repeat invocation), a counter suffix `-2`, `-3`, …
 * is appended until a free name is found.
 *
 * Non-destructive: uses `git branch <name> HEAD` (cannot overwrite an
 * existing branch) — failure to find a free name within 1000 attempts
 * surfaces as an error to the caller.
 */
export async function pinDetachedHead(
  workDir: string,
  runId: string,
): Promise<string | undefined> {
  const symRef = await new Deno.Command("git", {
    args: ["-C", workDir, "symbolic-ref", "-q", "HEAD"],
    stdout: "null",
    stderr: "null",
  }).output();
  if (symRef.success) return undefined;

  const baseName = `flowai/run-${runId}-orphan-rescue`;
  let name = baseName;
  for (let counter = 2; await branchExists(workDir, name); counter++) {
    if (counter > 1000) {
      throw new Error(
        `Could not find free rescue branch name after 1000 attempts (base: ${baseName})`,
      );
    }
    name = `${baseName}-${counter}`;
  }

  const create = await new Deno.Command("git", {
    args: ["-C", workDir, "branch", name, "HEAD"],
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!create.success) {
    const stderr = new TextDecoder().decode(create.stderr).trim();
    throw new Error(`git branch ${name} failed: ${stderr}`);
  }
  return name;
}

/** Check whether a local branch ref exists in `workDir`. */
async function branchExists(workDir: string, name: string): Promise<boolean> {
  const out = await new Deno.Command("git", {
    args: [
      "-C",
      workDir,
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/heads/${name}`,
    ],
    stdout: "null",
    stderr: "null",
  }).output();
  return out.success;
}

/** Run a git command, throw with context on failure. */
async function runGit(args: string[], errorContext: string): Promise<string> {
  const cmd = new Deno.Command("git", {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const result = await cmd.output();
  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(`${errorContext}${stderr ? `: ${stderr}` : ""}`);
  }
  return new TextDecoder().decode(result.stdout).trim();
}
