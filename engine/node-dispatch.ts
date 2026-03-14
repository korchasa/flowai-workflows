import type {
  NodeConfig,
  PipelineConfig,
  RunState,
  TemplateContext,
  Verbosity,
} from "./types.ts";
import { topoSort } from "./dag.ts";
import { runHuman } from "./human.ts";
import type { UserInput } from "./human.ts";
import {
  isNodeCompleted,
  markNodeFailed,
  markNodeSkipped,
  markRunAborted,
} from "./state.ts";
import type { OutputManager } from "./output.ts";

/** Shared execution context passed to extracted node executor free functions. */
export interface NodeExecutionContext {
  state: RunState;
  config: PipelineConfig;
  output: OutputManager;
  verbosity: Verbosity;
  buildContext: (nodeId: string, loopIteration?: number) => TemplateContext;
  saveState: () => Promise<void>;
  userInput: UserInput;
}

/** Execute a human node: prompts for user input via userInput interface. */
export async function executeHumanNode(
  execCtx: NodeExecutionContext,
  nodeId: string,
  node: NodeConfig,
): Promise<boolean> {
  const ctx = execCtx.buildContext(nodeId);
  const result = await runHuman(node, ctx, execCtx.userInput);

  if (result.aborted) {
    markRunAborted(execCtx.state);
    markNodeFailed(
      execCtx.state,
      nodeId,
      `Aborted by user (response: ${result.response})`,
      "aborted",
    );
    return false;
  }

  return result.success;
}

/**
 * Collect node IDs with `run_on` set from pipeline config.
 * These nodes execute in a final post-pipeline step after all DAG levels complete.
 */
export function collectPostPipelineNodes(
  nodes: Record<string, NodeConfig>,
): string[] {
  return Object.entries(nodes)
    .filter(([_, node]) => node.run_on !== undefined)
    .map(([id]) => id);
}

/**
 * Sort post-pipeline nodes topologically using their `inputs` field.
 * Only considers dependencies within the post-pipeline subset.
 * Guarantees e.g. post-B (inputs: [post-A]) runs after post-A.
 */
export function sortPostPipelineNodes(
  postPipelineIds: string[],
  nodes: Record<string, NodeConfig>,
): string[] {
  const subset = new Set(postPipelineIds);
  const deps = new Map<string, Set<string>>();
  for (const id of postPipelineIds) {
    const node = nodes[id];
    const internalInputs = (node.inputs ?? []).filter((inp) => subset.has(inp));
    deps.set(id, new Set(internalInputs));
  }
  const levels = topoSort(deps);
  return levels.flat();
}

/**
 * Find a NodeConfig by ID, searching both top-level nodes and loop body nodes.
 * Returns undefined if not found.
 */
export function findNodeConfig(
  config: PipelineConfig,
  nodeId: string,
): NodeConfig | undefined {
  if (config.nodes[nodeId]) return config.nodes[nodeId];
  for (const node of Object.values(config.nodes)) {
    if (node.type === "loop" && node.nodes && node.nodes[nodeId]) {
      return node.nodes[nodeId];
    }
  }
  return undefined;
}

/**
 * Collect all node IDs including nested body nodes from loop `nodes` sub-objects.
 * Returns a flat list suitable for `createRunState()`.
 */
export function collectAllNodeIds(config: PipelineConfig): string[] {
  const ids: string[] = [];
  for (const [id, node] of Object.entries(config.nodes)) {
    ids.push(id);
    if (node.type === "loop" && node.nodes) {
      for (const bodyId of Object.keys(node.nodes)) {
        ids.push(bodyId);
      }
    }
  }
  return ids;
}

/**
 * Execute post-pipeline nodes (those with `run_on` set), filtered by condition.
 * Runs failure hook first if pipeline failed. Skips nodes whose run_on condition
 * does not match the pipeline outcome. Swallows individual node errors.
 */
export async function executePostPipelineNodes(
  execCtx: NodeExecutionContext,
  postPipelineNodeIds: string[],
  pipelineSuccess: boolean,
  executeNode: (nodeId: string) => Promise<boolean>,
): Promise<void> {
  if (postPipelineNodeIds.length === 0) return;

  if (!pipelineSuccess) {
    await runFailureHook(
      execCtx.config.defaults?.on_failure_script,
      execCtx.output,
    );
  }

  for (const nodeId of postPipelineNodeIds) {
    if (isNodeCompleted(execCtx.state, nodeId)) continue;

    const nodeRunOn = execCtx.config.nodes[nodeId].run_on;
    if (nodeRunOn === "success" && !pipelineSuccess) {
      markNodeSkipped(execCtx.state, nodeId);
      execCtx.output.nodeSkipped(
        nodeId,
        "skipped: run_on=success but pipeline failed",
      );
      await execCtx.saveState();
      continue;
    }
    if (nodeRunOn === "failure" && pipelineSuccess) {
      markNodeSkipped(execCtx.state, nodeId);
      execCtx.output.nodeSkipped(
        nodeId,
        "skipped: run_on=failure but pipeline succeeded",
      );
      await execCtx.saveState();
      continue;
    }

    try {
      await executeNode(nodeId);
    } catch (err) {
      execCtx.output.warn(
        `Post-pipeline node ${nodeId} failed: ${(err as Error).message}`,
      );
    }
  }
}

/**
 * Execute the on_failure_script hook (domain-agnostic).
 * Swallows errors — failure hook must not crash the engine.
 */
export async function runFailureHook(
  script: string | undefined,
  output: OutputManager,
): Promise<void> {
  if (!script) return;
  try {
    const cmd = new Deno.Command(script, {
      stdout: "piped",
      stderr: "piped",
    });
    const result = await cmd.output();
    const stdout = new TextDecoder().decode(result.stdout).trim();
    const stderr = new TextDecoder().decode(result.stderr).trim();
    if (stdout) output.status("engine", `Hook stdout: ${stdout}`);
    if (stderr) output.warn(`Hook stderr: ${stderr}`);
    if (!result.success) {
      output.warn(`Failure hook exited with code ${result.code}`);
    } else {
      output.status("engine", "Failure hook completed");
    }
  } catch (err) {
    output.warn(`Failure hook error: ${(err as Error).message}`);
  }
}
