import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  parseGithubRemote,
  runPreflight,
  summarizeFailures,
} from "./preflight.ts";

// ---------------------------------------------------------------------------
// parseGithubRemote — pure parser, unit-testable without git.
// ---------------------------------------------------------------------------

Deno.test("parseGithubRemote — HTTPS .git URL", () => {
  assertEquals(
    parseGithubRemote("https://github.com/acme/demo.git"),
    { host: "github.com", slug: "acme/demo" },
  );
});

Deno.test("parseGithubRemote — HTTPS without .git", () => {
  assertEquals(
    parseGithubRemote("https://github.com/acme/demo"),
    { host: "github.com", slug: "acme/demo" },
  );
});

Deno.test("parseGithubRemote — SCP-SSH format", () => {
  assertEquals(
    parseGithubRemote("git@github.com:acme/demo.git"),
    { host: "github.com", slug: "acme/demo" },
  );
});

Deno.test("parseGithubRemote — URL-SSH format", () => {
  assertEquals(
    parseGithubRemote("ssh://git@github.com/acme/demo.git"),
    { host: "github.com", slug: "acme/demo" },
  );
});

Deno.test("parseGithubRemote — URL-SSH with port", () => {
  assertEquals(
    parseGithubRemote("ssh://git@github.com:22/acme/demo.git"),
    { host: "github.com", slug: "acme/demo" },
  );
});

Deno.test("parseGithubRemote — non-GitHub host", () => {
  assertEquals(
    parseGithubRemote("https://gitlab.com/acme/demo.git"),
    { host: "gitlab.com", slug: "acme/demo" },
  );
});

Deno.test("parseGithubRemote — unparseable returns undefined", () => {
  assertEquals(parseGithubRemote(""), undefined);
  assertEquals(parseGithubRemote("not-a-url"), undefined);
});

// ---------------------------------------------------------------------------
// summarizeFailures — rendering helper.
// ---------------------------------------------------------------------------

Deno.test("summarizeFailures — joins error messages as a bullet list", () => {
  const msg = summarizeFailures([
    "not a git repo",
    "origin points to gitlab.com",
  ]);
  // Message must contain both failures verbatim.
  if (!msg.includes("not a git repo")) {
    throw new Error(`summary missing first failure: ${msg}`);
  }
  if (!msg.includes("origin points to gitlab.com")) {
    throw new Error(`summary missing second failure: ${msg}`);
  }
});

// ---------------------------------------------------------------------------
// runPreflight — integration-ish tests that exercise the full check against
// a real tmp git repo. Requires `git` binary; skip if not available.
// ---------------------------------------------------------------------------

async function haveBinary(name: string): Promise<boolean> {
  try {
    const { success } = await new Deno.Command(name, {
      args: ["--version"],
      stdout: "null",
      stderr: "null",
    }).output();
    return success;
  } catch {
    return false;
  }
}

async function initGitRepo(root: string): Promise<void> {
  // Minimal repo: init + config identity + add a github remote + commit.
  const cmds = [
    ["init", "-q"],
    ["config", "user.email", "test@example.com"],
    ["config", "user.name", "test"],
    ["remote", "add", "origin", "https://github.com/acme/demo.git"],
  ];
  for (const args of cmds) {
    const { success, stderr } = await new Deno.Command("git", {
      args,
      cwd: root,
      stdout: "null",
      stderr: "piped",
    }).output();
    if (!success) {
      throw new Error(
        `git ${args.join(" ")}: ${new TextDecoder().decode(stderr)}`,
      );
    }
  }
}

Deno.test("runPreflight — clean git repo with github origin passes base check", async () => {
  if (!await haveBinary("git")) return;
  const root = await Deno.makeTempDir();
  try {
    await initGitRepo(root);
    const result = await runPreflight({
      cwd: root,
      allowDirty: true,
      targetDir: join(root, ".flowai-workflow"),
    });
    assertEquals(result.failures, []);
    assertEquals(result.githubSlug, "acme/demo");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("runPreflight — fails when .flowai-workflow already exists", async () => {
  if (!await haveBinary("git")) return;
  const root = await Deno.makeTempDir();
  try {
    await initGitRepo(root);
    await Deno.mkdir(join(root, ".flowai-workflow"));
    const result = await runPreflight({
      cwd: root,
      allowDirty: true,
      targetDir: join(root, ".flowai-workflow"),
    });
    const joined = result.failures.join("\n");
    if (!joined.includes("already initialized")) {
      throw new Error(`expected 'already initialized' in: ${joined}`);
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("runPreflight — fails when origin is not github.com", async () => {
  if (!await haveBinary("git")) return;
  const root = await Deno.makeTempDir();
  try {
    // init + non-github remote
    const cmds = [
      ["init", "-q"],
      ["config", "user.email", "test@example.com"],
      ["config", "user.name", "test"],
      ["remote", "add", "origin", "https://gitlab.com/acme/demo.git"],
    ];
    for (const args of cmds) {
      const { success } = await new Deno.Command("git", {
        args,
        cwd: root,
        stdout: "null",
        stderr: "null",
      }).output();
      if (!success) throw new Error(`git ${args.join(" ")} failed`);
    }
    const result = await runPreflight({
      cwd: root,
      allowDirty: true,
      targetDir: join(root, ".flowai-workflow"),
    });
    const joined = result.failures.join("\n");
    if (!joined.includes("github.com")) {
      throw new Error(`expected github.com in failures: ${joined}`);
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("runPreflight — fails when cwd is not a git repo", async () => {
  if (!await haveBinary("git")) return;
  const root = await Deno.makeTempDir();
  try {
    const result = await runPreflight({
      cwd: root,
      allowDirty: true,
      targetDir: join(root, ".flowai-workflow"),
    });
    const joined = result.failures.join("\n");
    if (!joined.toLowerCase().includes("git repo")) {
      throw new Error(`expected 'git repo' in failures: ${joined}`);
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
