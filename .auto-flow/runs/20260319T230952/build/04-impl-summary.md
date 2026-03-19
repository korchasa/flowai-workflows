## Summary

### Files Changed

- `.auto-flow/agents/agent-pm/SKILL.md` — removed `# BEFORE YOU DO ANYTHING` heading + shared-rules read paragraph (lines 7–11); "first tool call MUST be" line preserved
- `.auto-flow/agents/agent-architect/SKILL.md` — same removal; "first tool call MUST be" line preserved
- `.auto-flow/agents/agent-tech-lead/SKILL.md` — same removal; "first tool call MUST be" line preserved
- `.auto-flow/agents/agent-developer/SKILL.md` — same removal; "first tool call MUST be" line preserved
- `.auto-flow/agents/agent-qa/SKILL.md` — same removal; "first tool call MUST be" line preserved
- `.auto-flow/agents/agent-tech-lead-review/SKILL.md` — same removal; no first-tool-call line in this agent, `# Role:` now follows frontmatter directly

### Tests Added or Modified

None — these are markdown prompt template files. No TS logic changed; no new tests applicable.

### deno task check Result

PASS — all checks passed (format, lint, type check, CLI smoke test, pipeline integrity, HITL validation, AGENTS.md accuracy, comment scan).
