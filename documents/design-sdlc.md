# SDS: SDLC Workflow — Index

Design specification for the example SDLC workflow running on top of the
engine. Split across section files in [design-sdlc/](design-sdlc/) to fit
within the `Read` tool's 10k-token limit (working budget ~8k tokens per
file).

## Sections

- [00-intro.md](design-sdlc/00-intro.md) — §1 Intro, §2 Architecture
  (Pipeline DAG layout, removed legacy shell pipeline).
- [01-agents-and-hitl.md](design-sdlc/01-agents-and-hitl.md) —
  §3.1 Docker Image, §3.2 Stage Scripts (deleted), §3.3 Shared Library
  (`lib.sh`), §3.4 Agent Skills, §3.4.1 Two-Layer Reflection Memory,
  §3.5 HITL Pipeline Scripts.
- [02-dashboard-and-validation.md](design-sdlc/02-dashboard-and-validation.md)
  — §3.6 Pipeline Trigger, §3.7 Dashboard Generator, §3.8 Pipeline Config
  Validation, §3.8.1 HITL Artifact Source Validation, §3.9 SDLC Utility
  Scripts CLI Help, §3.10 SDLC Script JSDoc, §3.11 AGENTS.md Validation.
- [03-init-data-logic.md](design-sdlc/03-init-data-logic.md) — §3.12
  Project Init Scaffolder, §4 Data (commit strategy), §5 Logic
  (Dev+QA loop, HITL, tech-lead-review), §6 Non-Functional, §7 Constraints,
  §8 SRS Evidence Status.
