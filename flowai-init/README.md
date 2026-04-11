# @korchasa/flowai-workflow-init

Scaffolding library for `flowai-workflow init` — creates a ready-to-run
`.flowai-workflow/` directory in a target project by copying a template and
filling placeholders from wizard answers.

Pure deterministic code. No AI calls, no network. Invoked from
`engine/cli.ts` when the `init` subcommand is passed.

## Layout

- `mod.ts` — public entry point `runInit(argv)`.
- `types.ts` — `Answers`, `TemplateManifest`, `TemplateQuestion`.
- `scaffold.ts` — placeholder substitution, file copy, unwind.
- `autodetect.ts` — per-language handlers (`deno.json`, `package.json`, etc.).
- `preflight.ts` — git/gh/claude presence + GitHub remote validation.
- `wizard.ts` — interactive questionnaire (`@std/cli/prompts`).
- `templates/` — bundled template files.

## Hard dependencies (target project)

- `git` — version control.
- `gh` — GitHub CLI for issue triage, PR creation and merge.
- `claude` — Claude Code CLI for agent execution.
- Git remote on `origin` pointing to a `github.com` URL.

Preflight enforces all four before the wizard runs.
