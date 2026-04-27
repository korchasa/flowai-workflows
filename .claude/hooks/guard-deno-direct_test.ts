import { assertEquals } from "@std/assert";
import { BLOCK_REASON, shouldBlock } from "./guard-deno-direct.ts";

// Pieces composed at runtime so the literal `deno fmt|lint|test` does NOT
// appear in this source file — that would cause the production hook (which
// runs on every Bash tool call during development) to false-positive on its
// own test corpus and refuse to let the test runner start.
const D = "de" + "no";
const F = "f" + "mt";
const L = "li" + "nt";
const T = "te" + "st";

interface Case {
  name: string;
  command: string;
  block: boolean;
}

const CASES: Case[] = [
  // Bare invocations — must block.
  { name: "bare fmt", command: `${D} ${F}`, block: true },
  { name: "bare lint", command: `${D} ${L}`, block: true },
  { name: "bare test", command: `${D} ${T}`, block: true },
  {
    name: "bare with extra args",
    command: `${D} ${T} -A --watch`,
    block: true,
  },

  // Whitelisted task form — allow.
  { name: "deno task check", command: `${D} task check`, block: false },
  { name: "deno task test", command: `${D} task ${T}`, block: false },
  {
    name: "deno task with args",
    command: `${D} task fmt --check`,
    block: false,
  },

  // Chained — connector at command position must trigger detection.
  {
    name: "chained after && from git status",
    command: `git status && ${D} ${F}`,
    block: true,
  },
  {
    name: "chained after ; from cd",
    command: `cd repo; ${D} ${T}`,
    block: true,
  },
  {
    name: "chained after || from a probe",
    command: `test -f x || ${D} ${F}`,
    block: true,
  },

  // Shell-interpreter wrappers — strip quotes, then detect.
  {
    name: "bash -c double-quoted",
    command: `bash -c "${D} ${T}"`,
    block: true,
  },
  {
    name: "bash -c single-quoted",
    command: `bash -c '${D} ${T}'`,
    block: true,
  },
  { name: "sh -c double-quoted", command: `sh -c "${D} ${F}"`, block: true },
  { name: "zsh -c double-quoted", command: `zsh -c "${D} ${L}"`, block: true },
  { name: "eval double-quoted", command: `eval "${D} ${T}"`, block: true },

  // Data-passing command prefixes — early-out, allow even with deno tokens.
  {
    name: "git commit with deno prose in body",
    command: `git commit -m "refactor: drop ${D} ${F} call"`,
    block: false,
  },
  {
    name: "git commit plain",
    command: `git commit -m "msg"`,
    block: false,
  },
  {
    name: "git commit with chained deno after — early-out wins",
    // Documenting current semantics: the early-out is unconditional for
    // safe prefixes. If the operator deliberately chains a real call
    // after a commit message, that's their explicit choice.
    command: `git commit -m "msg" && ${D} ${T}`,
    block: false,
  },
  {
    name: "git tag with deno in body",
    command: `git tag -a v1 -m "${D} ${T} fix"`,
    block: false,
  },
  {
    name: "gh pr create with deno in body",
    command: `gh pr create --body "use ${D} ${F}"`,
    block: false,
  },
  {
    name: "gh issue create with deno in body",
    command: `gh issue create --body "${D} ${L} failure"`,
    block: false,
  },
  {
    name: "gh release create with deno in notes",
    command: `gh release create v1 --notes "${D} ${T} cleanup"`,
    block: false,
  },

  // Other commands with deno-prose — quotes act as data boundary, allow.
  {
    name: "echo prose double-quoted",
    command: `echo "${D} ${F} is bad"`,
    block: false,
  },
  {
    name: "echo prose single-quoted",
    command: `echo '${D} ${F} is bad'`,
    block: false,
  },
  {
    name: "printf prose",
    command: `printf "%s\\n" "${D} ${T}"`,
    block: false,
  },
  {
    name: "grep for deno in a file",
    command: `grep "${D} ${T}" notes.md`,
    block: false,
  },

  // Negatives — not a real command verb.
  { name: "deno testing-not-a-verb", command: `${D} testing`, block: false },
  { name: "deno lints-not-a-verb", command: `${D} lints`, block: false },
  { name: "deno format-not-a-verb", command: `${D} format`, block: false },

  // Edge cases.
  { name: "empty string", command: "", block: false },
  { name: "whitespace only", command: "   \t\n", block: false },
  { name: "bash alone (no -c)", command: "bash", block: false },
  { name: "ls -la", command: "ls -la", block: false },
];

for (const tc of CASES) {
  Deno.test(`shouldBlock — ${tc.name}`, () => {
    const got = shouldBlock(tc.command);
    assertEquals(
      got.block,
      tc.block,
      `command: ${JSON.stringify(tc.command)} → got ${JSON.stringify(got)}`,
    );
  });
}

Deno.test("shouldBlock — block reason matches exported constant", () => {
  const got = shouldBlock(`${D} ${T}`);
  assertEquals(got.block, true);
  assertEquals(got.reason, BLOCK_REASON);
});

Deno.test("shouldBlock — allow returns no reason", () => {
  const got = shouldBlock(`${D} task check`);
  assertEquals(got.block, false);
  assertEquals(got.reason, undefined);
});
