import { assertEquals } from "@std/assert";
import { parseInitArgs } from "./mod.ts";

Deno.test("parseInitArgs — defaults", () => {
  const parsed = parseInitArgs([]);
  assertEquals(parsed.kind, "run");
  if (parsed.kind !== "run") throw new Error("unreachable");
  assertEquals(parsed.template, "sdlc-claude");
  assertEquals(parsed.answersFile, undefined);
  assertEquals(parsed.dryRun, false);
  assertEquals(parsed.allowDirty, false);
});

Deno.test("parseInitArgs — --answers sets answersFile", () => {
  const parsed = parseInitArgs(["--answers", "ci.yaml"]);
  assertEquals(parsed.kind, "run");
  if (parsed.kind !== "run") throw new Error("unreachable");
  assertEquals(parsed.answersFile, "ci.yaml");
});

Deno.test("parseInitArgs — --template override", () => {
  const parsed = parseInitArgs(["--template", "custom"]);
  assertEquals(parsed.kind, "run");
  if (parsed.kind !== "run") throw new Error("unreachable");
  assertEquals(parsed.template, "custom");
});

Deno.test("parseInitArgs — --dry-run flag", () => {
  const parsed = parseInitArgs(["--dry-run"]);
  assertEquals(parsed.kind, "run");
  if (parsed.kind !== "run") throw new Error("unreachable");
  assertEquals(parsed.dryRun, true);
});

Deno.test("parseInitArgs — --allow-dirty flag", () => {
  const parsed = parseInitArgs(["--allow-dirty"]);
  assertEquals(parsed.kind, "run");
  if (parsed.kind !== "run") throw new Error("unreachable");
  assertEquals(parsed.allowDirty, true);
});

Deno.test("parseInitArgs — --help short-circuits", () => {
  const parsed = parseInitArgs(["--help"]);
  assertEquals(parsed.kind, "help");
});

Deno.test("parseInitArgs — -h alias", () => {
  const parsed = parseInitArgs(["-h"]);
  assertEquals(parsed.kind, "help");
});

Deno.test("parseInitArgs — unknown flag produces error", () => {
  const parsed = parseInitArgs(["--nope"]);
  assertEquals(parsed.kind, "error");
  if (parsed.kind !== "error") throw new Error("unreachable");
  if (!parsed.message.includes("--nope")) {
    throw new Error(`expected '--nope' in error: ${parsed.message}`);
  }
});

Deno.test("parseInitArgs — --answers missing value produces error", () => {
  const parsed = parseInitArgs(["--answers"]);
  assertEquals(parsed.kind, "error");
});

Deno.test("parseInitArgs — combined flags", () => {
  const parsed = parseInitArgs([
    "--template",
    "sdlc-claude",
    "--answers",
    "in.yaml",
    "--allow-dirty",
    "--dry-run",
  ]);
  assertEquals(parsed.kind, "run");
  if (parsed.kind !== "run") throw new Error("unreachable");
  assertEquals(parsed.template, "sdlc-claude");
  assertEquals(parsed.answersFile, "in.yaml");
  assertEquals(parsed.allowDirty, true);
  assertEquals(parsed.dryRun, true);
});
