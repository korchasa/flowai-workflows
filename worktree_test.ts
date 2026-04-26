import { assertEquals } from "@std/assert";
import {
  copyToOriginalRepo,
  createWorktree,
  getWorktreePath,
  pinDetachedHead,
  removeWorktree,
  worktreeExists,
} from "./worktree.ts";

Deno.test("getWorktreePath — returns expected path", () => {
  assertEquals(
    getWorktreePath("20260408T120000"),
    ".flowai-workflow/worktrees/20260408T120000",
  );
});

Deno.test("getWorktreePath — includes label in path", () => {
  assertEquals(
    getWorktreePath("20260408T120000-my-feature"),
    ".flowai-workflow/worktrees/20260408T120000-my-feature",
  );
});

Deno.test("worktreeExists — returns false for non-existent worktree", () => {
  assertEquals(worktreeExists("nonexistent-run-id-abc123"), false);
});

Deno.test("removeWorktree — swallows error for non-existent worktree", async () => {
  // Should not throw for a path that doesn't exist
  await removeWorktree("/tmp/nonexistent-worktree-abc123");
});

Deno.test("createWorktree — fails on fetch error with bad remote", async () => {
  // Create a temporary bare git repo with no 'origin' remote
  const tmpDir = await Deno.makeTempDir();
  const origCwd = Deno.cwd();
  try {
    // Initialize a fresh repo with no remotes
    const init = new Deno.Command("git", {
      args: ["init", "--initial-branch=main"],
      cwd: tmpDir,
      stdout: "null",
      stderr: "null",
    });
    await init.output();

    // Configure git user for commits
    const configName = new Deno.Command("git", {
      args: ["config", "user.email", "test@test.com"],
      cwd: tmpDir,
      stdout: "null",
      stderr: "null",
    });
    await configName.output();
    const configEmail = new Deno.Command("git", {
      args: ["config", "user.name", "Test"],
      cwd: tmpDir,
      stdout: "null",
      stderr: "null",
    });
    await configEmail.output();

    // Create an initial commit
    await Deno.writeTextFile(`${tmpDir}/README.md`, "test");
    const add = new Deno.Command("git", {
      args: ["add", "."],
      cwd: tmpDir,
      stdout: "null",
      stderr: "null",
    });
    await add.output();
    const commit = new Deno.Command("git", {
      args: ["commit", "-m", "init"],
      cwd: tmpDir,
      stdout: "null",
      stderr: "null",
    });
    await commit.output();

    // Chdir to temp repo (createWorktree uses relative paths)
    Deno.chdir(tmpDir);

    // createWorktree should fail because there's no 'origin' remote
    let thrown = false;
    try {
      await createWorktree("test-run");
    } catch (e) {
      thrown = true;
      assertEquals(
        (e as Error).message.includes("git fetch origin main failed"),
        true,
      );
    }
    assertEquals(thrown, true);
  } finally {
    Deno.chdir(origCwd);
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("worktree lifecycle — create, exists, remove", async () => {
  // Create a temporary repo with a local 'origin' to satisfy fetch
  const tmpOrigin = await Deno.makeTempDir();
  const tmpClone = await Deno.makeTempDir();
  const origCwd = Deno.cwd();

  try {
    // Set up origin repo
    await runGitCmd(["init", "--bare", "--initial-branch=main"], tmpOrigin);

    // Clone it to get a working repo with origin
    const clone = new Deno.Command("git", {
      args: ["clone", tmpOrigin, tmpClone],
      stdout: "null",
      stderr: "null",
    });
    await clone.output();

    // Configure and create initial commit on 'main'
    await runGitCmd(["config", "user.email", "test@test.com"], tmpClone);
    await runGitCmd(["config", "user.name", "Test"], tmpClone);
    await runGitCmd(["checkout", "-b", "main"], tmpClone);
    await Deno.writeTextFile(`${tmpClone}/README.md`, "test");
    await runGitCmd(["add", "."], tmpClone);
    await runGitCmd(["commit", "-m", "init"], tmpClone);
    await runGitCmd(["push", "-u", "origin", "main"], tmpClone);

    // Create worktrees directory
    await Deno.mkdir(`${tmpClone}/.flowai-workflow/worktrees`, {
      recursive: true,
    });

    // Change to clone dir
    Deno.chdir(tmpClone);

    const runId = "test-worktree-lifecycle";

    // Before creation: doesn't exist
    assertEquals(worktreeExists(runId), false);

    // Create worktree
    const path = await createWorktree(runId);
    assertEquals(path, `.flowai-workflow/worktrees/${runId}`);
    assertEquals(worktreeExists(runId), true);

    // Verify worktree has files from origin/main
    const readme = await Deno.readTextFile(`${path}/README.md`);
    assertEquals(readme, "test");

    // Remove worktree
    await removeWorktree(path);
    assertEquals(worktreeExists(runId), false);
  } finally {
    Deno.chdir(origCwd);
    await Deno.remove(tmpOrigin, { recursive: true });
    await Deno.remove(tmpClone, { recursive: true });
  }
});

Deno.test("copyToOriginalRepo — copies file from workDir to CWD-relative path", async () => {
  const tmpDir = await Deno.makeTempDir();
  const origCwd = Deno.cwd();
  try {
    Deno.chdir(tmpDir);

    // Create a workDir with a file
    const workDir = `${tmpDir}/worktree`;
    await Deno.mkdir(`${workDir}/subdir`, { recursive: true });
    await Deno.writeTextFile(`${workDir}/subdir/state.json`, '{"test": true}');

    // Copy to "original repo" (CWD-relative)
    await copyToOriginalRepo(workDir, "subdir/state.json");

    // Verify the copy
    const content = await Deno.readTextFile(`${tmpDir}/subdir/state.json`);
    assertEquals(content, '{"test": true}');
  } finally {
    Deno.chdir(origCwd);
    await Deno.remove(tmpDir, { recursive: true });
  }
});

// --- pinDetachedHead (FR-E51) ---

/** Set up a temp git repo with one initial commit on `main`. */
async function setupMiniRepo(): Promise<string> {
  const tmp = await Deno.makeTempDir();
  await runGitCmd(["init", "--initial-branch=main"], tmp);
  await runGitCmd(["config", "user.email", "test@test.com"], tmp);
  await runGitCmd(["config", "user.name", "Test"], tmp);
  await Deno.writeTextFile(`${tmp}/README.md`, "init\n");
  await runGitCmd(["add", "."], tmp);
  await runGitCmd(["commit", "-m", "init"], tmp);
  return tmp;
}

Deno.test("pinDetachedHead — creates rescue branch on detached HEAD", async () => {
  const repo = await setupMiniRepo();
  try {
    // Detach HEAD (without -b) — leaves main ref alone, HEAD = same commit.
    await runGitCmd(["checkout", "--detach", "HEAD"], repo);

    const name = await pinDetachedHead(repo, "20260426T120000");
    assertEquals(name, "flowai/run-20260426T120000-orphan-rescue");

    // Branch ref exists.
    const verify = await new Deno.Command("git", {
      args: [
        "-C",
        repo,
        "rev-parse",
        "--verify",
        "--quiet",
        `refs/heads/${name}`,
      ],
      stdout: "null",
      stderr: "null",
    }).output();
    assertEquals(verify.success, true);
  } finally {
    await Deno.remove(repo, { recursive: true });
  }
});

Deno.test("pinDetachedHead — returns undefined when HEAD on named branch", async () => {
  const repo = await setupMiniRepo();
  try {
    // HEAD is on `main` after init — already named.
    const name = await pinDetachedHead(repo, "20260426T120000");
    assertEquals(name, undefined);

    // No rescue branch was created.
    const verify = await new Deno.Command("git", {
      args: [
        "-C",
        repo,
        "rev-parse",
        "--verify",
        "--quiet",
        "refs/heads/flowai/run-20260426T120000-orphan-rescue",
      ],
      stdout: "null",
      stderr: "null",
    }).output();
    assertEquals(verify.success, false);
  } finally {
    await Deno.remove(repo, { recursive: true });
  }
});

Deno.test("pinDetachedHead — appends counter when branch name already exists", async () => {
  const repo = await setupMiniRepo();
  try {
    await runGitCmd(["checkout", "--detach", "HEAD"], repo);

    const first = await pinDetachedHead(repo, "20260426T120000");
    assertEquals(first, "flowai/run-20260426T120000-orphan-rescue");

    // Re-detach (still at same commit) and re-invoke.
    await runGitCmd(["checkout", "--detach", "HEAD"], repo);
    const second = await pinDetachedHead(repo, "20260426T120000");
    assertEquals(second, "flowai/run-20260426T120000-orphan-rescue-2");

    await runGitCmd(["checkout", "--detach", "HEAD"], repo);
    const third = await pinDetachedHead(repo, "20260426T120000");
    assertEquals(third, "flowai/run-20260426T120000-orphan-rescue-3");
  } finally {
    await Deno.remove(repo, { recursive: true });
  }
});

Deno.test("pinDetachedHead — rescue branch points at detached HEAD commit", async () => {
  const repo = await setupMiniRepo();
  try {
    // Make an extra commit so HEAD is past `main`.
    await runGitCmd(["checkout", "--detach", "HEAD"], repo);
    await Deno.writeTextFile(`${repo}/extra.md`, "orphan\n");
    await runGitCmd(["add", "extra.md"], repo);
    await runGitCmd(["commit", "-m", "orphan-commit"], repo);

    // Capture HEAD sha
    const headSha = (await new Deno.Command("git", {
      args: ["-C", repo, "rev-parse", "HEAD"],
      stdout: "piped",
      stderr: "null",
    }).output().then((o) => new TextDecoder().decode(o.stdout))).trim();

    const name = await pinDetachedHead(repo, "RUN");
    assertEquals(name, "flowai/run-RUN-orphan-rescue");

    const branchSha = (await new Deno.Command("git", {
      args: ["-C", repo, "rev-parse", `refs/heads/${name}`],
      stdout: "piped",
      stderr: "null",
    }).output().then((o) => new TextDecoder().decode(o.stdout))).trim();

    assertEquals(branchSha, headSha);
  } finally {
    await Deno.remove(repo, { recursive: true });
  }
});

/** Helper to run a git command in a specific directory. */
async function runGitCmd(args: string[], cwd: string): Promise<void> {
  const cmd = new Deno.Command("git", {
    args,
    cwd,
    stdout: "null",
    stderr: "null",
  });
  const result = await cmd.output();
  if (!result.success) {
    throw new Error(`git ${args.join(" ")} failed in ${cwd}`);
  }
}
