---
name: flowai-workflow-adapt-agents
description: >-
  Adapt flowai-workflow agents to the current project after a framework update.
  Merges upstream agent changes with project-specific customizations.
user-invocable: true
argument-hint: "[agent-name]"
---

# Adapt Agents After Update

## Overview

When the flowai-workflow framework is updated, agent definitions may change.
This skill merges upstream changes with your project-specific adaptations,
preserving your customizations while incorporating new features and fixes.

## Steps

**Narration rule:** before every step below, print one short sentence
telling the user what you are about to do (what will be read, which file
will be diffed or written). The goal is no surprises — the user should
always know the next action before it happens. Do not bundle multiple
steps into one announcement; narrate each one as you reach it.

### 1. Detect installed agents

Announce first, e.g.:
"Listing files in `.flowai-workflow/agents/` to see which agents you
have installed (read-only)."

Detect installed agents in `.flowai-workflow/agents/`.

### 2. Compare against upstream

Announce first, e.g.:
"Comparing each installed agent against its upstream template version.
Read-only — I'm only computing diffs, nothing is written yet."

Compare each agent against the upstream template version.

### 3. Per-agent merge loop

For each agent with upstream changes, repeat:

1. **Announce the diff.** Example:
   "Showing the upstream diff for `agent-<name>.md`. No file is touched
   until you approve."
   Display the upstream diff.

2. **Announce the proposal.** Example:
   "Proposing a merged version of `agent-<name>.md` that keeps your
   project-specific sections and folds in upstream changes. Still
   read-only — waiting for your approval."
   Show the proposed merge.

3. **Announce the write.** Example:
   "Writing the merged version to `.flowai-workflow/agents/<name>.md`.
   Only this single file is modified."
   Apply the merge after the user confirms.

### 4. Summary

Announce first, e.g.:
"All agents processed. Printing a summary of which files were adapted;
no further changes."

Report summary of adapted agents.

## Notes

- Adaptation is conservative: project-specific sections are preserved.
- If a conflict cannot be auto-resolved, the skill presents both versions
  and asks the user to choose.
- Run this skill after `flowai-workflow` framework updates (e.g., after
  `deno install` pulls a new version).
