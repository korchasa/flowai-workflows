# Meta-Agent Memory

## Agent Baselines
- pm (specification): 11t/$0.55/89s — stable (was 11t/$0.52 in 052837)
- architect (design): 11t/$0.52/66s — cost up from $0.36 baseline, same turns
- tech-lead (decision): 14t/$0.44/77s — stable
- developer (build): 11t/$0.50/89s — REGRESSED from 5t/$0.28. Scope creep: committed 4 SKILL.md + meta.md
- qa (verify): 19t/$0.75/165s — REGRESSED from 16t/$0.43. Skill self-invoke + tool-results path typos
- Total run cost: $2.76 (up from $2.24)
- 1 iteration (QA passed first try)

## Active Patterns
- developer-scope-creep: NEW, first seen 20260314T052906. Developer committed
  `.claude/skills/agent-{developer,pm,qa,tech-lead}/SKILL.md` + `documents/meta.md`
  — NONE in task breakdown. Added explicit prohibition in prompt.
- qa-skill-self-invoke: NEW, first seen 20260314T052906. QA called
  `Skill: agent-qa` — redundant prompt load, wastes 1 turn + doubles context.
  Added FORBIDDEN rule.
- qa-tool-results-path-typos: NEW, first seen 20260314T052906. QA typed
  `toulu_` instead of `toolu_` twice — 2 wasted reads from path transposition.
  Hard to fix via prompt; monitoring.
- qa-grep-after-read-v4: WATCHING (algorithm fix from 052837). 0 Grep-after-Read
  in 052906 — algorithm approach working. 2 clean runs.
- pm-grep-after-read-v2: WATCHING (algorithm fix from 052837). Need to verify in
  052906 — PM had 11t/$0.55 (was 11t/$0.52), within normal variance.

## Resolved Patterns
- pm-tool-results-reread: RESOLVED (3+ clean runs)
- pm-branch-shortcut-regression: RESOLVED (3+ clean runs)
- developer-grep-after-read: RESOLVED (3+ clean runs)
- qa-double-check: RESOLVED (3+ clean runs)
- tech-lead-write-rewrite: RESOLVED (3+ clean runs)
- All other previously resolved patterns: RESOLVED (3+ clean runs)

## Applied Fixes Log
- 20260313T021326–20260314T052837: (compressed — see git history for details)
- 20260314T052906: developer — added `.claude/skills/` and `documents/meta.md`
  to explicit forbidden list (Scope + Allowed File Modifications). Evidence:
  committed 4 SKILL.md + meta.md not in task breakdown → scope creep, cost
  $0.50 (was $0.28).
- 20260314T052906: qa — added "FORBIDDEN: Skill tool" rule. Evidence: QA called
  `Skill: agent-qa` → redundant prompt load, 19t/$0.75 (was 16t/$0.43).

## Lessons Learned
- Total pipeline cost baseline for S-effort issue: ~$2.24.
- Run artifacts under .sdlc/runs/ are gitignored — agents must use `git add -f`.
- QA self-approval fails (same user can't approve own PR). Need fallback path.
- **Blacklist approach fails for Bash commands.** WHITELIST is correct.
- **Rule placement matters.** HARD STOP before Responsibilities = strongest.
- **Cross-agent patterns:** Fix in one agent, apply to ALL.
- **Positive algorithms > prohibition.** Algorithm approach for Grep-after-Read
  showing 2 consecutive clean runs (QA).
- **Cost trajectory:** $5.09 → $2.31 → $2.24 → $2.76. Regression in 052906
  caused by developer scope creep + QA Skill self-invoke.
- **Scope enforcement needs explicit file path deny-lists.** Generic "only modify
  task files" insufficient — developer committed agent prompt files as if in-scope.
- **LLM path typos (toolu_ → toulu_) waste reads.** Hard to prevent via prompt.
