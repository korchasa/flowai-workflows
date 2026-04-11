#!/usr/bin/env -S deno run -A
/**
 * @module
 * Self-contained verification for `@korchasa/flowai-workflow-init`.
 * Runs: format, lint, type-check, tests, doc-lint, publish dry-run.
 *
 * Invoked via: `deno task check` from the `flowai-init/` directory.
 * The package is a workspace member, so this script assumes CWD is the
 * package root — not the repository root.
 */

async function run(
  cmd: string,
  args: string[],
  label: string,
): Promise<void> {
  console.log(`\n--- ${label} ---`);
  console.log(`> ${cmd} ${args.join(" ")}`);
  const proc = new Deno.Command(cmd, {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });
  const { success } = await proc.output();
  if (!success) {
    console.error(`FAILED: ${label}`);
    Deno.exit(1);
  }
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      // Templates are static assets — skip them from type-check walk.
      if (entry.name === "templates") continue;
      yield* walkDir(path);
    } else if (entry.isFile) {
      yield path;
    }
  }
}

if (import.meta.main) {
  console.log("=== @korchasa/flowai-workflow-init: Full Check ===");

  // Format the package directory.
  await run("deno", ["fmt", "."], "Formatting (auto-fix)");

  // Lint the package directory.
  await run("deno", ["lint", "."], "Linting");

  // Type check all .ts files (source + tests). Excludes scripts/ (dev tool,
  // not shipped) and templates/ (static assets, not TypeScript).
  const typeCheckFiles: string[] = [];
  for await (const entry of walkDir(".")) {
    if (!entry.endsWith(".ts")) continue;
    if (entry.startsWith("./scripts/")) continue;
    typeCheckFiles.push(entry);
  }
  await run("deno", ["check", ...typeCheckFiles.sort()], "Type Check");

  // Tests — scoped to this package.
  await run("deno", ["test", "-A", "--no-check", "."], "Tests");

  // Doc lint — missing JSDoc, private-type-ref, circular deps on public API.
  await run("deno", ["doc", "--lint", "mod.ts"], "Doc Lint");

  // Publish dry-run — catches JSR slow-types, invalid paths, missing explicit
  // types on public API, and exports pointing at nonexistent files.
  await run(
    "deno",
    ["publish", "--dry-run", "--allow-dirty"],
    "Publish Dry-Run",
  );

  console.log(
    "\n=== @korchasa/flowai-workflow-init: All checks passed! ===",
  );
}
