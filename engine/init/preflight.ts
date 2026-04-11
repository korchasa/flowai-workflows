/**
 * @module
 * Environment precondition checks for `flowai-workflow init`. All checks are
 * collected up-front, so one run surfaces every misconfig instead of failing
 * one at a time.
 *
 * Checks performed:
 * - Current working directory is inside a git worktree.
 * - A git remote named `origin` exists and points to a `github.com` URL.
 * - The target `.flowai-workflow/` directory does not already exist.
 * - (Unless `allowDirty: true`) the git worktree has no uncommitted changes.
 */

/** Single preflight check outcome. */
export interface PreflightResult {
  /** Human-readable failure messages. Empty on success. */
  failures: string[];
  /** Parsed `owner/repo` when origin is a github.com remote. */
  githubSlug?: string;
}

/** Options passed to {@link runPreflight}. */
export interface PreflightOptions {
  /** Project root directory (usually `Deno.cwd()`). */
  cwd: string;
  /** Path that MUST NOT exist (usually `<cwd>/.flowai-workflow`). */
  targetDir: string;
  /** When true, skip the clean-git-tree check. */
  allowDirty: boolean;
}

/** Parsed owner/repo from a git remote URL. */
export interface GitRemoteInfo {
  /** Host portion, e.g. `github.com`. */
  host: string;
  /** `owner/repo` slug, `.git` suffix stripped. */
  slug: string;
}

/**
 * Parse a git remote URL into `{host, slug}`. Accepts the three forms git
 * remotes typically use (all real-world URLs; some environments rewrite via
 * `url.<base>.insteadOf`, so the init must tolerate whichever shape git
 * surfaces at runtime):
 *
 * - HTTPS:   `https://<host>/<owner>/<repo>[.git]`
 * - SCP-SSH: `git@<host>:<owner>/<repo>[.git]`
 * - URL-SSH: `ssh://git@<host>[:<port>]/<owner>/<repo>[.git]`
 *
 * Returns `undefined` if the string doesn't match any of the above.
 */
export function parseGithubRemote(url: string): GitRemoteInfo | undefined {
  const trimmed = url.trim();
  if (trimmed.length === 0) return undefined;

  // HTTPS form.
  const httpsMatch = trimmed.match(
    /^https?:\/\/([^/]+)\/([^/]+\/[^/]+?)(?:\.git)?$/,
  );
  if (httpsMatch) {
    return { host: httpsMatch[1], slug: httpsMatch[2] };
  }

  // URL-SSH form: ssh://[user@]host[:port]/owner/repo(.git)?
  // Host portion is captured without user@ prefix and without :port suffix.
  const urlSshMatch = trimmed.match(
    /^ssh:\/\/(?:[^@/]+@)?([^:/]+)(?::\d+)?\/([^/]+\/[^/]+?)(?:\.git)?$/,
  );
  if (urlSshMatch) {
    return { host: urlSshMatch[1], slug: urlSshMatch[2] };
  }

  // SCP-SSH form: [user@]host:owner/repo(.git)?
  const scpSshMatch = trimmed.match(
    /^(?:[^@/]+@)?([^:/]+):([^/]+\/[^/]+?)(?:\.git)?$/,
  );
  if (scpSshMatch) {
    return { host: scpSshMatch[1], slug: scpSshMatch[2] };
  }

  return undefined;
}

/**
 * Render a list of preflight failures as a multi-line human-readable error
 * for stderr. The first line is a summary header; each failure is a bullet.
 */
export function summarizeFailures(failures: string[]): string {
  if (failures.length === 0) return "";
  const header = failures.length === 1
    ? "Preflight check failed:"
    : `${failures.length} preflight checks failed:`;
  return [header, ...failures.map((f) => `  - ${f}`)].join("\n");
}

// ---------------------------------------------------------------------------
// Internal helpers — small subprocess wrappers.
// ---------------------------------------------------------------------------

async function gitOutput(
  cwd: string,
  args: string[],
): Promise<{ ok: boolean; stdout: string }> {
  try {
    const proc = new Deno.Command("git", {
      cwd,
      args,
      stdout: "piped",
      stderr: "null",
    });
    const { success, stdout } = await proc.output();
    return { ok: success, stdout: new TextDecoder().decode(stdout).trim() };
  } catch {
    return { ok: false, stdout: "" };
  }
}

async function isGitRepo(cwd: string): Promise<boolean> {
  const { ok, stdout } = await gitOutput(cwd, [
    "rev-parse",
    "--is-inside-work-tree",
  ]);
  return ok && stdout === "true";
}

async function getGitRemoteOrigin(
  cwd: string,
): Promise<string | undefined> {
  const { ok, stdout } = await gitOutput(cwd, [
    "remote",
    "get-url",
    "origin",
  ]);
  if (!ok || stdout.length === 0) return undefined;
  return stdout;
}

async function isGitTreeClean(cwd: string): Promise<boolean> {
  const { ok, stdout } = await gitOutput(cwd, ["status", "--porcelain"]);
  return ok && stdout.length === 0;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public entry point — runs all checks, collects failures, returns structured
// result. Caller decides whether to exit/print.
// ---------------------------------------------------------------------------

/**
 * Run every preflight check against the options. Returns a result with a
 * (possibly empty) list of failure messages; the caller decides whether to
 * exit.
 */
export async function runPreflight(
  opts: PreflightOptions,
): Promise<PreflightResult> {
  const failures: string[] = [];
  let githubSlug: string | undefined;

  // Git repo check. If git itself is missing, gitOutput catches the
  // spawn failure and isGitRepo returns false — surfacing as "not a
  // git repo" which is still actionable.
  if (!await isGitRepo(opts.cwd)) {
    failures.push(
      `${opts.cwd} is not a git repo — run \`git init\` first`,
    );
  } else {
    // Remote + origin host check.
    const originUrl = await getGitRemoteOrigin(opts.cwd);
    if (!originUrl) {
      failures.push(
        "git remote `origin` is not configured — the SDLC template " +
          "requires a GitHub remote",
      );
    } else {
      const parsed = parseGithubRemote(originUrl);
      if (!parsed) {
        failures.push(
          `git remote origin (${originUrl}) could not be parsed`,
        );
      } else if (parsed.host !== "github.com") {
        failures.push(
          `git remote origin points to ${parsed.host}; the SDLC template ` +
            "requires github.com",
        );
      } else {
        githubSlug = parsed.slug;
      }
    }

    // Clean-tree check (skipped with --allow-dirty).
    if (!opts.allowDirty && !await isGitTreeClean(opts.cwd)) {
      failures.push(
        "git working tree has uncommitted changes — commit, stash, or " +
          "pass --allow-dirty",
      );
    }
  }

  // Target dir must not already exist.
  if (await pathExists(opts.targetDir)) {
    failures.push(
      `${opts.targetDir} already initialized — remove it manually to re-init`,
    );
  }

  return { failures, githubSlug };
}
