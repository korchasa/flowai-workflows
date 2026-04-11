import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { detectAll, detectFns } from "./autodetect.ts";

// Helper — builds a tmp project with the given files, returns the path.
async function withProject(
  files: Record<string, string>,
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = await Deno.makeTempDir();
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = join(root, rel);
      await Deno.mkdir(join(full, "..").replace(/\/\.\.$/, ""), {
        recursive: true,
      }).catch(() => {});
      // mkdir above is a rough attempt; use ensureDir semantics manually:
      const parts = rel.split("/");
      parts.pop();
      if (parts.length > 0) {
        await Deno.mkdir(join(root, ...parts), { recursive: true });
      }
      await Deno.writeTextFile(full, content);
    }
    await fn(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// project_name
// ---------------------------------------------------------------------------

Deno.test("detect project_name — prefers deno.json#name", async () => {
  await withProject(
    {
      "deno.json": JSON.stringify({ name: "@acme/demo" }),
      "package.json": JSON.stringify({ name: "fallback" }),
    },
    async (root) => {
      assertEquals(await detectFns.project_name(root), "@acme/demo");
    },
  );
});

Deno.test("detect project_name — package.json when no deno.json", async () => {
  await withProject(
    { "package.json": JSON.stringify({ name: "pkg-name" }) },
    async (root) => {
      assertEquals(await detectFns.project_name(root), "pkg-name");
    },
  );
});

Deno.test("detect project_name — Cargo.toml package.name", async () => {
  await withProject(
    {
      "Cargo.toml": '[package]\nname = "rust-demo"\nversion = "0.1.0"\n',
    },
    async (root) => {
      assertEquals(await detectFns.project_name(root), "rust-demo");
    },
  );
});

Deno.test("detect project_name — go.mod basename", async () => {
  await withProject(
    { "go.mod": "module github.com/acme/go-demo\n\ngo 1.21\n" },
    async (root) => {
      assertEquals(await detectFns.project_name(root), "go-demo");
    },
  );
});

Deno.test("detect project_name — pyproject.toml [project].name", async () => {
  await withProject(
    {
      "pyproject.toml": '[project]\nname = "py-demo"\nversion = "0.1.0"\n',
    },
    async (root) => {
      assertEquals(await detectFns.project_name(root), "py-demo");
    },
  );
});

Deno.test("detect project_name — falls back to Deno.cwd() basename", async () => {
  // An empty directory: handler should return basename of its path.
  const root = await Deno.makeTempDir({ prefix: "baseline-test-" });
  try {
    const detected = await detectFns.project_name(root);
    // basename() is the last path segment.
    const lastSegment = root.split("/").filter((s) => s.length > 0).pop()!;
    assertEquals(detected, lastSegment);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// test_cmd
// ---------------------------------------------------------------------------

Deno.test("detect test_cmd — deno.json string task", async () => {
  await withProject(
    { "deno.json": JSON.stringify({ tasks: { test: "deno test -A" } }) },
    async (root) => {
      assertEquals(await detectFns.test_cmd(root), "deno test -A");
    },
  );
});

Deno.test("detect test_cmd — deno.json object task", async () => {
  await withProject(
    {
      "deno.json": JSON.stringify({
        tasks: { test: { command: "deno test -A --foo", description: "x" } },
      }),
    },
    async (root) => {
      assertEquals(await detectFns.test_cmd(root), "deno test -A --foo");
    },
  );
});

Deno.test("detect test_cmd — deno.json without test task", async () => {
  await withProject(
    { "deno.json": JSON.stringify({ tasks: { fmt: "deno fmt" } }) },
    async (root) => {
      assertEquals(await detectFns.test_cmd(root), "deno task test");
    },
  );
});

Deno.test("detect test_cmd — package.json scripts.test", async () => {
  await withProject(
    { "package.json": JSON.stringify({ scripts: { test: "jest" } }) },
    async (root) => {
      assertEquals(await detectFns.test_cmd(root), "jest");
    },
  );
});

Deno.test("detect test_cmd — package.json without test script", async () => {
  await withProject(
    { "package.json": JSON.stringify({ scripts: {} }) },
    async (root) => {
      assertEquals(await detectFns.test_cmd(root), "npm test");
    },
  );
});

Deno.test("detect test_cmd — Cargo.toml → cargo test", async () => {
  await withProject(
    { "Cargo.toml": '[package]\nname = "x"\nversion = "0.1.0"\n' },
    async (root) => {
      assertEquals(await detectFns.test_cmd(root), "cargo test");
    },
  );
});

Deno.test("detect test_cmd — go.mod → go test ./...", async () => {
  await withProject(
    { "go.mod": "module acme/x\n" },
    async (root) => {
      assertEquals(await detectFns.test_cmd(root), "go test ./...");
    },
  );
});

Deno.test("detect test_cmd — unknown stack returns empty string", async () => {
  await withProject({}, async (root) => {
    assertEquals(await detectFns.test_cmd(root), "");
  });
});

// ---------------------------------------------------------------------------
// lint_cmd
// ---------------------------------------------------------------------------

Deno.test("detect lint_cmd — deno.json check task", async () => {
  await withProject(
    {
      "deno.json": JSON.stringify({
        tasks: { check: "deno run -A scripts/check.ts" },
      }),
    },
    async (root) => {
      assertEquals(
        await detectFns.lint_cmd(root),
        "deno run -A scripts/check.ts",
      );
    },
  );
});

Deno.test("detect lint_cmd — deno.json without check task → deno task check fallback", async () => {
  await withProject(
    { "deno.json": JSON.stringify({ tasks: {} }) },
    async (root) => {
      assertEquals(await detectFns.lint_cmd(root), "deno task check");
    },
  );
});

Deno.test("detect lint_cmd — package.json scripts.lint", async () => {
  await withProject(
    { "package.json": JSON.stringify({ scripts: { lint: "eslint ." } }) },
    async (root) => {
      assertEquals(await detectFns.lint_cmd(root), "eslint .");
    },
  );
});

Deno.test("detect lint_cmd — package.json without lint script", async () => {
  await withProject(
    { "package.json": JSON.stringify({ scripts: {} }) },
    async (root) => {
      assertEquals(await detectFns.lint_cmd(root), "npm run lint");
    },
  );
});

Deno.test("detect lint_cmd — Cargo.toml → cargo clippy", async () => {
  await withProject(
    { "Cargo.toml": '[package]\nname = "x"\nversion = "0.1.0"\n' },
    async (root) => {
      assertEquals(await detectFns.lint_cmd(root), "cargo clippy");
    },
  );
});

Deno.test("detect lint_cmd — go.mod → go vet", async () => {
  await withProject(
    { "go.mod": "module acme/x\n" },
    async (root) => {
      assertEquals(await detectFns.lint_cmd(root), "go vet ./...");
    },
  );
});

// ---------------------------------------------------------------------------
// detectAll — aggregate contract.
// ---------------------------------------------------------------------------

Deno.test("detectAll — aggregates all handler results", async () => {
  await withProject(
    {
      "deno.json": JSON.stringify({
        name: "all-detect",
        tasks: { test: "deno test", check: "deno task check" },
      }),
    },
    async (root) => {
      const all = await detectAll(root);
      assertEquals(all.PROJECT_NAME, "all-detect");
      assertEquals(all.TEST_CMD, "deno test");
      assertEquals(all.LINT_CMD, "deno task check");
    },
  );
});
