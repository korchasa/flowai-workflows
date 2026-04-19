import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { join } from "@std/path";
import {
  copyTemplate,
  listTemplateFiles,
  substitutePlaceholders,
  unwindScaffold,
  writeTemplateMetadata,
} from "./scaffold.ts";
import type { Answers, TemplateManifest } from "./types.ts";

// ---------------------------------------------------------------------------
// substitutePlaceholders
// ---------------------------------------------------------------------------

Deno.test("substitutePlaceholders — replaces known placeholders", () => {
  const answers = { FOO: "bar", BAZ: "qux" } as unknown as Answers;
  const result = substitutePlaceholders("hello __FOO__ and __BAZ__", answers);
  assertEquals(result, "hello bar and qux");
});

Deno.test("substitutePlaceholders — replaces the same placeholder twice", () => {
  const answers = { FOO: "bar" } as unknown as Answers;
  const result = substitutePlaceholders("__FOO__ / __FOO__", answers);
  assertEquals(result, "bar / bar");
});

Deno.test("substitutePlaceholders — throws on unknown placeholder", () => {
  const answers = { FOO: "bar" } as unknown as Answers;
  assertThrows(
    () => substitutePlaceholders("hello __UNKNOWN__", answers),
    Error,
    "__UNKNOWN__",
  );
});

Deno.test("substitutePlaceholders — ignores non-placeholder underscores", () => {
  const answers = { FOO: "bar" } as unknown as Answers;
  // Single underscores and leading-digit tokens should not match the regex.
  assertEquals(
    substitutePlaceholders("_FOO_ and __1FOO__", answers),
    "_FOO_ and __1FOO__",
  );
});

Deno.test("substitutePlaceholders — empty answer value substitutes cleanly", () => {
  const answers = { FOO: "" } as unknown as Answers;
  assertEquals(substitutePlaceholders("[__FOO__]", answers), "[]");
});

// ---------------------------------------------------------------------------
// listTemplateFiles — walks a directory tree returning relative paths.
// ---------------------------------------------------------------------------

Deno.test("listTemplateFiles — walks a directory tree", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(tmp, "a"), { recursive: true });
    await Deno.mkdir(join(tmp, "b", "c"), { recursive: true });
    await Deno.writeTextFile(join(tmp, "root.md"), "x");
    await Deno.writeTextFile(join(tmp, "a", "one.md"), "x");
    await Deno.writeTextFile(join(tmp, "b", "c", "two.md"), "x");

    const files = (await listTemplateFiles(tmp)).sort();
    assertEquals(files, ["a/one.md", "b/c/two.md", "root.md"]);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// copyTemplate — end-to-end scaffold into a tmp dir.
// ---------------------------------------------------------------------------

const SIMPLE_MANIFEST: TemplateManifest = {
  name: "test",
  version: "1",
  requires: [],
  questions: [
    { key: "PROJECT_NAME", label: "Project name", required: true },
    { key: "DEFAULT_BRANCH", label: "Default branch", default: "main" },
    { key: "TEST_CMD", label: "Test command", default: "" },
    { key: "LINT_CMD", label: "Lint command", default: "" },
  ],
  files: {
    copy: [
      // Matches the real manifest shape: source directory is the fully
      // qualified template tree under `files/`, target is the top-level
      // `.flowai-workflow/` in the project.
      { from: "files/.flowai-workflow/**", to: ".flowai-workflow/" },
    ],
  },
};

const SIMPLE_ANSWERS: Answers = {
  PROJECT_NAME: "demo",
  DEFAULT_BRANCH: "main",
  TEST_CMD: "npm test",
  LINT_CMD: "npm run lint",
};

async function buildFakeTemplate(root: string): Promise<void> {
  await Deno.mkdir(join(root, "files", ".flowai-workflow"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(root, "files", ".flowai-workflow", "workflow.yaml"),
    'name: "__PROJECT_NAME__"\nbranch: "__DEFAULT_BRANCH__"\n',
  );
  await Deno.writeTextFile(
    join(root, "files", ".flowai-workflow", "script.sh"),
    '#!/bin/sh\necho "__TEST_CMD__"\n',
  );
}

Deno.test("copyTemplate — writes substituted files into fresh target", async () => {
  const templateRoot = await Deno.makeTempDir();
  const target = await Deno.makeTempDir();
  try {
    await buildFakeTemplate(templateRoot);
    const created = await copyTemplate(
      templateRoot,
      target,
      SIMPLE_MANIFEST,
      SIMPLE_ANSWERS,
    );

    const workflow = await Deno.readTextFile(
      join(target, ".flowai-workflow", "workflow.yaml"),
    );
    assertEquals(workflow, 'name: "demo"\nbranch: "main"\n');

    const script = await Deno.readTextFile(
      join(target, ".flowai-workflow", "script.sh"),
    );
    assertEquals(script, '#!/bin/sh\necho "npm test"\n');

    // createdPaths must include every written file (for unwind).
    const denormalized = created.map((p) => p.replace(target + "/", ""));
    const relWorkflow = join(".flowai-workflow", "workflow.yaml");
    const relScript = join(".flowai-workflow", "script.sh");
    if (!denormalized.includes(relWorkflow)) {
      throw new Error(
        `createdPaths missing workflow.yaml: ${JSON.stringify(denormalized)}`,
      );
    }
    if (!denormalized.includes(relScript)) {
      throw new Error(
        `createdPaths missing script.sh: ${JSON.stringify(denormalized)}`,
      );
    }
  } finally {
    await Deno.remove(templateRoot, { recursive: true });
    await Deno.remove(target, { recursive: true });
  }
});

Deno.test("copyTemplate — fails if target file already exists", async () => {
  const templateRoot = await Deno.makeTempDir();
  const target = await Deno.makeTempDir();
  try {
    await buildFakeTemplate(templateRoot);
    // Pre-create a conflicting file.
    await Deno.mkdir(join(target, ".flowai-workflow"), { recursive: true });
    await Deno.writeTextFile(
      join(target, ".flowai-workflow", "workflow.yaml"),
      "pre-existing",
    );

    await assertRejects(
      () => copyTemplate(templateRoot, target, SIMPLE_MANIFEST, SIMPLE_ANSWERS),
      Error,
      "already exists",
    );
  } finally {
    await Deno.remove(templateRoot, { recursive: true });
    await Deno.remove(target, { recursive: true });
  }
});

Deno.test("copyTemplate — unknown placeholder aborts and returns empty createdPaths", async () => {
  const templateRoot = await Deno.makeTempDir();
  const target = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(templateRoot, "files", ".flowai-workflow"), {
      recursive: true,
    });
    await Deno.writeTextFile(
      join(templateRoot, "files", ".flowai-workflow", "bad.md"),
      "__UNKNOWN_KEY__",
    );

    await assertRejects(
      () => copyTemplate(templateRoot, target, SIMPLE_MANIFEST, SIMPLE_ANSWERS),
      Error,
      "__UNKNOWN_KEY__",
    );
  } finally {
    await Deno.remove(templateRoot, { recursive: true });
    await Deno.remove(target, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// unwindScaffold — deletes tracked paths in reverse order.
// ---------------------------------------------------------------------------

Deno.test("unwindScaffold — removes only tracked files", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const trackedFile = join(tmp, "tracked.md");
    const untrackedFile = join(tmp, "untracked.md");
    await Deno.writeTextFile(trackedFile, "x");
    await Deno.writeTextFile(untrackedFile, "x");

    await unwindScaffold([trackedFile]);

    // Untracked file must survive.
    const untrackedStat = await Deno.stat(untrackedFile);
    assertEquals(untrackedStat.isFile, true);

    // Tracked file must be gone.
    let missing = false;
    try {
      await Deno.stat(trackedFile);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) missing = true;
    }
    assertEquals(missing, true);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("unwindScaffold — silent on already-missing paths", async () => {
  // Should not throw when a tracked path no longer exists on disk.
  await unwindScaffold(["/tmp/definitely-not-there-12345"]);
});

// ---------------------------------------------------------------------------
// writeTemplateMetadata — .template.json format.
// ---------------------------------------------------------------------------

Deno.test("writeTemplateMetadata — writes a valid JSON file", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const metaPath = join(tmp, ".flowai-workflow", ".template.json");
    await Deno.mkdir(join(tmp, ".flowai-workflow"));
    await writeTemplateMetadata(
      metaPath,
      SIMPLE_MANIFEST,
      SIMPLE_ANSWERS,
      "0.2.0",
    );
    const content = await Deno.readTextFile(metaPath);
    const parsed = JSON.parse(content) as {
      version: number;
      template: string;
      template_version: string;
      engine_version: string;
      created_at: string;
      answers: Answers;
    };
    assertEquals(parsed.version, 1);
    assertEquals(parsed.template, "test");
    assertEquals(parsed.template_version, "1");
    assertEquals(parsed.engine_version, "0.2.0");
    assertEquals(parsed.answers, SIMPLE_ANSWERS);
    // created_at must be ISO 8601 — parseable.
    if (Number.isNaN(Date.parse(parsed.created_at))) {
      throw new Error(`created_at not ISO 8601: ${parsed.created_at}`);
    }
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});
