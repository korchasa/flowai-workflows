import { assertEquals } from "@std/assert";
import { extractFrontmatterField, runLoop } from "./loop.ts";
import type { LoopRunOptions } from "./loop.ts";
import { OutputManager } from "./output.ts";
import type { PipelineConfig, RunState, TemplateContext } from "./types.ts";

// Note: Full integration tests for runLoop require claude CLI.
// These tests cover the pure logic: frontmatter extraction and structure.

Deno.test("extractFrontmatterField — extracts simple string", () => {
  const content = `---
verdict: PASS
---
# QA Report
All checks passed.`;

  assertEquals(extractFrontmatterField(content, "verdict"), "PASS");
});

Deno.test("extractFrontmatterField — extracts FAIL value", () => {
  const content = `---
verdict: FAIL
---
# QA Report
Issues found.`;

  assertEquals(extractFrontmatterField(content, "verdict"), "FAIL");
});

Deno.test("extractFrontmatterField — returns undefined for missing field", () => {
  const content = `---
verdict: PASS
---
# Report`;

  assertEquals(extractFrontmatterField(content, "status"), undefined);
});

Deno.test("extractFrontmatterField — returns undefined for no frontmatter", () => {
  const content = `# Just a regular markdown file
No frontmatter here.`;

  assertEquals(extractFrontmatterField(content, "verdict"), undefined);
});

Deno.test("extractFrontmatterField — handles numeric values as string", () => {
  const content = `---
score: 95
---
# Report`;

  assertEquals(extractFrontmatterField(content, "score"), "95");
});

Deno.test("extractFrontmatterField — handles multiple fields", () => {
  const content = `---
variant: "Variant B"
verdict: PASS
confidence: high
---
# Decision`;

  assertEquals(extractFrontmatterField(content, "variant"), "Variant B");
  assertEquals(extractFrontmatterField(content, "verdict"), "PASS");
  assertEquals(extractFrontmatterField(content, "confidence"), "high");
});

Deno.test("extractFrontmatterField — handles invalid YAML gracefully", () => {
  const content = `---
: invalid yaml [
---
# Broken`;

  assertEquals(extractFrontmatterField(content, "verdict"), undefined);
});

Deno.test("extractFrontmatterField — handles empty frontmatter", () => {
  const content = `---
---
# Empty frontmatter`;

  assertEquals(extractFrontmatterField(content, "verdict"), undefined);
});

Deno.test("extractFrontmatterField — boolean values converted to string", () => {
  const content = `---
approved: true
---
# Report`;

  assertEquals(extractFrontmatterField(content, "approved"), "true");
});

Deno.test("LoopRunOptions — accepts output field", () => {
  const output = new OutputManager("verbose");
  // Verify the type allows output field (compile-time check)
  const opts: Partial<LoopRunOptions> = {
    loopNodeId: "exec-qa-loop",
    output,
  };
  assertEquals(opts.output instanceof OutputManager, true);
});

Deno.test("LoopRunOptions — output is optional", () => {
  const opts: Partial<LoopRunOptions> = {
    loopNodeId: "exec-qa-loop",
  };
  assertEquals(opts.output, undefined);
});

// --- bodyResults accumulation tests ---

function makeBuildCtx(
  nodeDir: string,
): (_nodeId: string, iteration: number) => TemplateContext {
  return (_nodeId: string, iteration: number) => ({
    node_dir: nodeDir,
    run_dir: "/tmp/test-run",
    run_id: "test-run",
    args: {},
    env: {},
    input: {},
    loop: { iteration },
  });
}

Deno.test("LoopResult — bodyResults present on empty body (no iterations needed)", async () => {
  // Loop with empty body runs zero body nodes per iteration, then checks condition.
  // Condition extraction will fail (no files), so loop should exhaust max_iterations.
  const config: PipelineConfig = {
    name: "test",
    version: "1",
    nodes: {
      "empty-loop": {
        type: "loop",
        label: "Empty Loop",
        body: [],
        condition_node: "cond",
        condition_field: "verdict",
        exit_value: "PASS",
        max_iterations: 1,
      },
      cond: { type: "agent", label: "Cond" },
    },
  };
  const state: RunState = {
    run_id: "test-run",
    config_path: "test.yaml",
    started_at: new Date().toISOString(),
    status: "running",
    args: {},
    env: {},
    nodes: {
      "empty-loop": { status: "running" },
      cond: { status: "pending" },
    },
  };
  const tmpDir = await Deno.makeTempDir();
  try {
    const result = await runLoop({
      loopNodeId: "empty-loop",
      config,
      state,
      buildCtx: makeBuildCtx(tmpDir),
    });
    assertEquals(Array.isArray(result.bodyResults), true);
    assertEquals(result.bodyResults.length, 0);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});
