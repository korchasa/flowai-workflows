/**
 * @module
 * Per-language autodetect handlers for wizard defaults. Each handler takes a
 * project root path, inspects manifest files in priority order, and returns a
 * default value for one of the placeholder keys.
 *
 * Handlers are pure: read-only file inspection plus read-only git plumbing
 * commands (`git symbolic-ref`, `git remote get-url`). They never invoke
 * build tools or package managers, and never mutate project state.
 *
 * When no language handler matches, test_cmd and lint_cmd return an empty
 * string — the wizard falls back to its `default` field or prompts the user.
 */

import { basename, join } from "@std/path";
import type { Answers } from "./types.ts";

// ---------------------------------------------------------------------------
// File readers — small helpers that return parsed structures or undefined.
// ---------------------------------------------------------------------------

async function readJsonSafe<T = unknown>(
  path: string,
): Promise<T | undefined> {
  try {
    const raw = await Deno.readTextFile(path);
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function readTextSafe(path: string): Promise<string | undefined> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return undefined;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Minimal shape of fields we read from `deno.json`. */
interface DenoJson {
  name?: string;
  tasks?: Record<string, string | { command?: string }>;
}

/** Minimal shape of fields we read from `package.json`. */
interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
}

/** Reads the first named task out of `deno.json#tasks`. */
function denoTask(manifest: DenoJson, key: string): string | undefined {
  const raw = manifest.tasks?.[key];
  if (raw === undefined) return undefined;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && typeof raw.command === "string") {
    return raw.command;
  }
  return undefined;
}

/**
 * Extract a TOML scalar value: `key = "value"`. We avoid pulling in a full
 * TOML parser — only a handful of simple string fields are needed for
 * autodetect. Returns undefined if the key is missing or the value isn't a
 * plain quoted string on a single line.
 */
function tomlScalar(content: string, key: string): string | undefined {
  const line = content
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith(`${key} = `) || l.startsWith(`${key}=`));
  if (!line) return undefined;
  const match = line.match(/=\s*"([^"]*)"/);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// Handlers — exported as a record so `detectAll` can drive the dispatch loop
// and tests can call individual handlers directly.
// ---------------------------------------------------------------------------

/**
 * Public registry of per-key autodetect handlers.
 *
 * Each handler returns a non-undefined string on success. `project_name`
 * always returns a value (uses `Deno.cwd()` basename as the last-resort
 * fallback). Command handlers (`test_cmd`, `lint_cmd`) return empty string
 * when no known language signal is present — the wizard prompts user in
 * that case.
 */
export const detectFns = {
  async project_name(projectRoot: string): Promise<string> {
    const deno = await readJsonSafe<DenoJson>(join(projectRoot, "deno.json"));
    if (deno?.name) return deno.name;

    const pkg = await readJsonSafe<PackageJson>(
      join(projectRoot, "package.json"),
    );
    if (pkg?.name) return pkg.name;

    const goMod = await readTextSafe(join(projectRoot, "go.mod"));
    if (goMod) {
      const moduleLine = goMod
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("module "));
      if (moduleLine) {
        const modulePath = moduleLine.slice("module ".length).trim();
        return basename(modulePath);
      }
    }

    const cargo = await readTextSafe(join(projectRoot, "Cargo.toml"));
    if (cargo) {
      // Crude section-aware lookup: find `name = "..."` under `[package]`.
      const packageSection = cargo.split(/^\[/m).find((s) =>
        s.startsWith("package]")
      );
      if (packageSection) {
        const name = tomlScalar(packageSection, "name");
        if (name) return name;
      }
    }

    const pyproject = await readTextSafe(join(projectRoot, "pyproject.toml"));
    if (pyproject) {
      const projectSection = pyproject.split(/^\[/m).find((s) =>
        s.startsWith("project]")
      );
      if (projectSection) {
        const name = tomlScalar(projectSection, "name");
        if (name) return name;
      }
    }

    return basename(projectRoot);
  },

  async default_branch(_projectRoot: string): Promise<string> {
    const proc = new Deno.Command("git", {
      args: ["symbolic-ref", "refs/remotes/origin/HEAD"],
      stdout: "piped",
      stderr: "null",
    });
    try {
      const { success, stdout } = await proc.output();
      if (!success) return "main";
      const ref = new TextDecoder().decode(stdout).trim();
      const prefix = "refs/remotes/origin/";
      if (ref.startsWith(prefix)) return ref.slice(prefix.length);
      return "main";
    } catch {
      return "main";
    }
  },

  async test_cmd(projectRoot: string): Promise<string> {
    const deno = await readJsonSafe<DenoJson>(join(projectRoot, "deno.json"));
    if (deno) {
      const task = denoTask(deno, "test");
      if (task) return task;
      return "deno task test";
    }

    const pkg = await readJsonSafe<PackageJson>(
      join(projectRoot, "package.json"),
    );
    if (pkg) {
      const script = pkg.scripts?.test;
      if (script) return script;
      return "npm test";
    }

    if (await fileExists(join(projectRoot, "Cargo.toml"))) return "cargo test";
    if (await fileExists(join(projectRoot, "go.mod"))) return "go test ./...";
    if (await fileExists(join(projectRoot, "pyproject.toml"))) return "pytest";

    return "";
  },

  async lint_cmd(projectRoot: string): Promise<string> {
    const deno = await readJsonSafe<DenoJson>(join(projectRoot, "deno.json"));
    if (deno) {
      const task = denoTask(deno, "check");
      if (task) return task;
      return "deno task check";
    }

    const pkg = await readJsonSafe<PackageJson>(
      join(projectRoot, "package.json"),
    );
    if (pkg) {
      const script = pkg.scripts?.lint;
      if (script) return script;
      return "npm run lint";
    }

    if (await fileExists(join(projectRoot, "Cargo.toml"))) {
      return "cargo clippy";
    }
    if (await fileExists(join(projectRoot, "go.mod"))) return "go vet ./...";

    return "";
  },
} as const;

/**
 * Convenience aggregator — runs all four handlers against `projectRoot`
 * and returns a `Partial<Answers>` with the detected values. Used by the
 * wizard to pre-fill prompts.
 */
export async function detectAll(
  projectRoot: string,
): Promise<Partial<Answers>> {
  const [PROJECT_NAME, DEFAULT_BRANCH, TEST_CMD, LINT_CMD] = await Promise.all([
    detectFns.project_name(projectRoot),
    detectFns.default_branch(projectRoot),
    detectFns.test_cmd(projectRoot),
    detectFns.lint_cmd(projectRoot),
  ]);
  return { PROJECT_NAME, DEFAULT_BRANCH, TEST_CMD, LINT_CMD };
}
