import { assertEquals } from "@std/assert";
import { buildEngineEnv, captureCliVersion } from "./spawn-env.ts";

Deno.test("buildEngineEnv — returns DISABLE_AUTOUPDATER=1", () => {
  const env = buildEngineEnv();
  assertEquals(env["DISABLE_AUTOUPDATER"], "1");
});

Deno.test("buildEngineEnv — always-wins: DISABLE_AUTOUPDATER is always present", () => {
  const env1 = buildEngineEnv();
  const env2 = buildEngineEnv();
  assertEquals("DISABLE_AUTOUPDATER" in env1, true);
  assertEquals(env1["DISABLE_AUTOUPDATER"], env2["DISABLE_AUTOUPDATER"]);
});

Deno.test("captureCliVersion — returns non-empty version string when claude on PATH", async () => {
  let version: string;
  try {
    version = await captureCliVersion();
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return; // claude not on PATH, skip
    throw e;
  }
  assertEquals(typeof version, "string");
  assertEquals(version.length > 0, true);
});
