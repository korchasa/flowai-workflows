# Development Commands

## Standard Interface

- `check` - The main command for comprehensive project verification. Performs
  the following steps:
  - build the project
  - comment-scan: "TODO", "FIXME", "HACK", "XXX", debugger calls, linters and
    formatters suppression
  - code formatting check
  - static code analysis
  - runs all project tests
- `test <path>` - Runs a single test.
- `dev` - Runs the application in development mode with watch mode enabled.
- `prod` - Runs the application in production mode.

## Detected Commands

- `deno task check` - Full project verification (format, lint, test)
- `deno task test` - Run all tests
- `deno task start-in-claude` - Launch claude CLI to run the application
- `deno fmt` - Format code
- `deno lint` - Lint code
- `deno test` - Run tests

## Command Scripts

- `scripts/check.ts` - Comprehensive check: fmt --check, lint, test,
  comment-scan
- `scripts/start.ts` - Launch claude CLI with prompt to run the app
- `scripts/test.ts` - Run single test file or all tests
- `scripts/dev.ts` - Start dev mode (watch)
- `scripts/prod.ts` - Start production mode
