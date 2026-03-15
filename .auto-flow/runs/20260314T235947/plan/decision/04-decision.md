---
variant: "Variant C: Meta-agent migration + lightweight agent convention"
tasks:
  - desc: "Create .auto-flow/memory/ directory with 7 seed files"
    files: [".auto-flow/memory/agent-pm.md", ".auto-flow/memory/agent-architect.md", ".auto-flow/memory/agent-tech-lead.md", ".auto-flow/memory/agent-developer.md", ".auto-flow/memory/agent-qa.md", ".auto-flow/memory/agent-meta-agent.md", ".auto-flow/memory/agent-tech-lead-review.md"]
  - desc: "Rewrite agent-meta-agent/SKILL.md: replace documents/meta.md with .auto-flow/memory/agent-meta-agent.md, update lifecycle to full-rewrite, update Allowed File Modifications"
    files: [".auto-flow/agents/agent-meta-agent/SKILL.md"]
  - desc: "Add shared ~10-line memory convention block to 6 remaining agent SKILL.md files (read at start, rewrite at end, <=50 lines, add to Allowed File Modifications)"
    files: [".auto-flow/agents/agent-pm/SKILL.md", ".auto-flow/agents/agent-architect/SKILL.md", ".auto-flow/agents/agent-tech-lead/SKILL.md", ".auto-flow/agents/agent-developer/SKILL.md", ".auto-flow/agents/agent-qa/SKILL.md", ".auto-flow/agents/agent-tech-lead-review/SKILL.md"]
  - desc: "Update pipeline.yaml: optimize node task_template (meta.md -> memory path), add memory path hint to other agents' task_template"
    files: [".auto-flow/pipeline.yaml"]
  - desc: "Remove documents/meta.md references from agent-developer and agent-tech-lead SKILL.md forbidden-modification lists"
    files: [".auto-flow/agents/agent-developer/SKILL.md", ".auto-flow/agents/agent-tech-lead/SKILL.md"]
  - desc: "Remove documents/meta.md (or replace with pointer to new location)"
    files: ["documents/meta.md"]
---

## Justification

I selected Variant C for three reasons:

1. **Vision alignment:** AGENTS.md states "agents are stateless — all context
   from file artifacts and system prompts." Per-agent memory files extend this
   pattern — each agent reads its own file artifact at start and rewrites it at
   end, preserving the stateless-per-invocation model while adding cross-run
   learning. The shared convention block keeps memory behavior consistent without
   per-agent divergence, matching the project's compressed-style documentation
   approach.

2. **Coverage vs blast radius:** Variant A touches all 7 SKILL.md files with
   full per-agent customization — high merge-conflict risk with concurrent runs.
   Variant B relies solely on task_template injection — agents lack structured
   guidance on format, size limits, and retention policy, leading to inconsistent
   memory quality. Variant C hits the sweet spot: meta-agent gets full migration
   (it's the only agent with existing memory logic), while the other 6 get a
   uniform ~10-line block that's small enough to avoid merge conflicts but
   explicit enough to ensure consistent memory format.

3. **Effort efficiency:** Effort S (same as Variant B) but with stronger agent
   guidance. The shared convention block is copy-paste across 6 files — no
   per-agent customization needed. Memory format can evolve organically via
   meta-agent runs without requiring SKILL.md changes.

## Task Descriptions

### Task 1: Create memory directory and seed files

I create `.auto-flow/memory/` with 7 files, one per agent. Each seeded with
minimal header (`# Reflection Memory — <agent-name>`) and empty content section.
Files are git-tracked (not gitignored) to enable meta-agent cross-run analysis.

### Task 2: Rewrite meta-agent SKILL.md

I replace all `documents/meta.md` references with
`.auto-flow/memory/agent-meta-agent.md`. I change the memory lifecycle from
append-based to full-rewrite (current-state snapshot, <=50 lines). I update the
memory format specification: anti-patterns, effective strategies, environment
quirks, baseline metrics. I update `## Allowed File Modifications` to reflect
the new path.

### Task 3: Add shared memory convention to 6 agents

I define a ~10-line `## Reflection Memory` section and add it to each of the 6
remaining SKILL.md files. The block specifies:
- Read `.auto-flow/memory/<self>.md` at session start (before main work).
- Rewrite at session end with <=50 lines of compressed learnings.
- Content categories: anti-patterns encountered, effective strategies,
  environment quirks, baseline metrics.
- Add `.auto-flow/memory/<self>.md` to `## Allowed File Modifications`.

No per-agent customization — same template for all 6.

### Task 4: Update pipeline.yaml

I update the `optimize` node `task_template` to replace `documents/meta.md`
references with `.auto-flow/memory/agent-meta-agent.md`. I add a memory path
hint to each agent's `task_template` as belt-and-suspenders reinforcement:
`Read your reflection memory at .auto-flow/memory/<agent-name>.md before starting. Update it when done.`

### Task 5: Clean up meta.md references

I remove `documents/meta.md` from the forbidden-modification lists in
`agent-developer/SKILL.md` (lines 174, 258) and `agent-tech-lead/SKILL.md`
(line 15). The file no longer exists, so these restrictions are obsolete.

### Task 6: Remove documents/meta.md

I delete `documents/meta.md` or replace its content with a single-line pointer
to the new location (`.auto-flow/memory/`). Deletion preferred — git history
preserves the content.

## Summary

- I selected Variant C (Meta-agent migration + lightweight convention) for its balance of coverage, blast radius, and vision alignment with the stateless-agent model.
- I defined 6 ordered tasks: seed memory directory, rewrite meta-agent, add shared convention to 6 agents, update pipeline.yaml, clean up stale references, remove meta.md.
- I will create branch `sdlc/issue-117` and open a draft PR with SDS updates reflecting the per-agent memory component design.
