import { assertEquals, assertThrows } from "@std/assert";
import { join } from "@std/path";
import {
  mergeAnswers,
  parseAnswersYaml,
  readAnswersFile,
  resolveFinalAnswers,
} from "./wizard.ts";
import type { Answers, TemplateManifest } from "./types.ts";

// ---------------------------------------------------------------------------
// parseAnswersYaml — string → Partial<Answers> parser.
// ---------------------------------------------------------------------------

Deno.test("parseAnswersYaml — minimal valid document", () => {
  const answers = parseAnswersYaml(
    `PROJECT_NAME: demo\nDEFAULT_BRANCH: main\nTEST_CMD: npm test\nLINT_CMD: npm run lint\n`,
  );
  assertEquals(answers, {
    PROJECT_NAME: "demo",
    DEFAULT_BRANCH: "main",
    TEST_CMD: "npm test",
    LINT_CMD: "npm run lint",
  });
});

Deno.test("parseAnswersYaml — partial document returns partial", () => {
  const answers = parseAnswersYaml(`PROJECT_NAME: demo\n`);
  assertEquals(answers, { PROJECT_NAME: "demo" });
});

Deno.test("parseAnswersYaml — rejects unknown keys", () => {
  assertThrows(
    () => parseAnswersYaml(`PROJECT_NAME: demo\nEXTRA_FIELD: oops\n`),
    Error,
    "EXTRA_FIELD",
  );
});

Deno.test("parseAnswersYaml — rejects non-string values", () => {
  assertThrows(
    () => parseAnswersYaml(`PROJECT_NAME: 42\n`),
    Error,
    "PROJECT_NAME",
  );
});

Deno.test("parseAnswersYaml — rejects non-object root", () => {
  assertThrows(() => parseAnswersYaml(`- a\n- b\n`), Error);
});

// ---------------------------------------------------------------------------
// readAnswersFile — thin wrapper around parseAnswersYaml + fs.
// ---------------------------------------------------------------------------

Deno.test("readAnswersFile — reads and parses a file", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const path = join(tmp, "answers.yaml");
    await Deno.writeTextFile(
      path,
      `PROJECT_NAME: demo\nDEFAULT_BRANCH: main\n`,
    );
    const answers = await readAnswersFile(path);
    assertEquals(answers.PROJECT_NAME, "demo");
    assertEquals(answers.DEFAULT_BRANCH, "main");
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// mergeAnswers — detected ← file/input override.
// ---------------------------------------------------------------------------

Deno.test("mergeAnswers — detected values used when no override", () => {
  const merged = mergeAnswers({ PROJECT_NAME: "autodetected" }, {});
  assertEquals(merged.PROJECT_NAME, "autodetected");
});

Deno.test("mergeAnswers — override wins over detected", () => {
  const merged = mergeAnswers(
    { PROJECT_NAME: "autodetected" },
    { PROJECT_NAME: "user" },
  );
  assertEquals(merged.PROJECT_NAME, "user");
});

Deno.test("mergeAnswers — empty-string override does NOT clobber detected", () => {
  // Empty-string means "autodetect handler returned nothing"; preserve
  // the later/higher-priority value rather than letting blanks overwrite.
  const merged = mergeAnswers(
    { PROJECT_NAME: "autodetected" },
    { PROJECT_NAME: "" },
  );
  assertEquals(merged.PROJECT_NAME, "autodetected");
});

// ---------------------------------------------------------------------------
// resolveFinalAnswers — end-to-end non-interactive path.
// ---------------------------------------------------------------------------

const FAKE_MANIFEST: TemplateManifest = {
  name: "test",
  version: "1",
  requires: [],
  questions: [
    { key: "PROJECT_NAME", label: "Project name", required: true },
    { key: "DEFAULT_BRANCH", label: "Default branch", default: "main" },
    { key: "TEST_CMD", label: "Test command", default: "" },
    { key: "LINT_CMD", label: "Lint command", default: "" },
  ],
  files: { copy: [] },
};

Deno.test("resolveFinalAnswers — non-interactive uses detected+file, applies defaults", () => {
  const detected: Partial<Answers> = {
    PROJECT_NAME: "from-detect",
    DEFAULT_BRANCH: "main",
    TEST_CMD: "",
    LINT_CMD: "",
  };
  const fileAnswers: Partial<Answers> = {
    TEST_CMD: "pytest",
  };
  const final = resolveFinalAnswers(FAKE_MANIFEST, detected, fileAnswers);
  assertEquals(final.PROJECT_NAME, "from-detect");
  assertEquals(final.DEFAULT_BRANCH, "main");
  assertEquals(final.TEST_CMD, "pytest");
  // LINT_CMD empty → falls back to question.default (also empty).
  assertEquals(final.LINT_CMD, "");
});

Deno.test("resolveFinalAnswers — missing required field throws", () => {
  const detected: Partial<Answers> = { DEFAULT_BRANCH: "main" };
  assertThrows(
    () => resolveFinalAnswers(FAKE_MANIFEST, detected, {}),
    Error,
    "PROJECT_NAME",
  );
});

Deno.test("resolveFinalAnswers — uses question.default when detected empty", () => {
  const detected: Partial<Answers> = {
    PROJECT_NAME: "demo",
    DEFAULT_BRANCH: "",
    TEST_CMD: "",
    LINT_CMD: "",
  };
  const final = resolveFinalAnswers(FAKE_MANIFEST, detected, {});
  assertEquals(final.DEFAULT_BRANCH, "main");
});
