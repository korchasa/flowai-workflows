import type { NodeConfig } from "./types.ts";
import { getNodeDir } from "./state.ts";
import type { NodeExecutionContext } from "./node-dispatch.ts";

/** Execute a merge node: copies each input directory as a subdirectory. */
export async function executeMergeNode(
  execCtx: NodeExecutionContext,
  nodeId: string,
  node: NodeConfig,
): Promise<boolean> {
  const nodeDir = getNodeDir(execCtx.state.run_id, nodeId);
  await Deno.mkdir(nodeDir, { recursive: true });

  for (const inputId of node.inputs ?? []) {
    const inputDir = getNodeDir(execCtx.state.run_id, inputId);
    const targetDir = `${nodeDir}/${inputId}`;
    try {
      await copyDir(inputDir, targetDir);
    } catch {
      // Input may not have produced files
    }
  }

  return true;
}

/** Recursively copy a directory. */
export async function copyDir(src: string, dest: string): Promise<void> {
  await Deno.mkdir(dest, { recursive: true });
  for await (const entry of Deno.readDir(src)) {
    const srcPath = `${src}/${entry.name}`;
    const destPath = `${dest}/${entry.name}`;
    if (entry.isDirectory) {
      await copyDir(srcPath, destPath);
    } else {
      await Deno.copyFile(srcPath, destPath);
    }
  }
}
