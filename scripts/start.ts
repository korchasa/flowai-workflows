// scripts/start.ts
// Launch claude CLI with a prompt to start the application.

const prompt = Deno.args.join(" ") ||
  "Run the application using `deno task run`. Monitor the output and report the result.";

console.log(`> claude -p "${prompt}"`);

const cmd = new Deno.Command("claude", {
  args: ["--dangerously-skip-permissions", "-p", prompt],
  stdin: "null",
  stdout: "inherit",
  stderr: "inherit",
  env: { CLAUDECODE: "" },
});

const { code } = await cmd.output();
Deno.exit(code);
