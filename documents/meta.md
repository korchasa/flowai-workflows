# Meta-Agent Memory

## Agent Baselines
- pm (specification): 24t/$1.00/244s — regressed (was 18t/$0.79). SRS re-reads + Grep-after-Read.
- architect (design): 16t/$0.54/80s — stable (was 17t/$0.57)
- tech-lead (decision): 20t/$0.79/154s — slight regression (was 15t/$0.57)
- developer (build): 43t/$2.19/409s — major regression (was 29t/$1.55). Batch-then-fix pattern.
- qa (verify): 23t/$0.78/176s — regressed (was 15t/$0.37). Duplicate gh commands.
- Total run cost: $5.29 (up from $3.85)
- 1 iteration (QA passed first try)

## Active Patterns
- skill-self-invoke-cross-agent: RESOLVED (clean in 172829). No Skill calls.
- agent-skill-read-waste: RESOLVED (clean in 172829). No .claude/skills/ reads.
- merge-conflict-corruption: RESOLVED (clean in 172829).
- cross-run-path-confusion: RESOLVED (3rd clean run: 172829).
- tech-lead-design-reread: RESOLVED (2nd clean run: 172829).
- developer-bash-whitelist-violation: RESOLVED (2nd clean run: 172829).
- scope-unaware-doc-reads: WATCHING, first seen 172829, last seen 175521.
  Root cause in 175521: pipeline YAML task_template hardcodes sdlc doc refs.
  Fix applied in 175521 (pipeline.yaml) + PM scope-aware STEP 3.
  Run 181758 was engine+sdlc scope (all 4 reads correct) — cannot verify yet.
- developer-grep-after-read-v2: RESOLVED (2nd clean run: 181758). 0 Grep calls.
- developer-no-precheck-existing-impl: WATCHING, first seen 20260314T182039.
  Fix applied (pre-flight git log). Run 181758: fresh impl, precheck N/A.
- qa-source-exploration: WATCHING, first seen 175521. QA made 9 Grep calls on
  source files + ran `deno test` separately. Fix: HARD STOP on source Grep,
  prohibited `deno test`. Not seen in 181758 (0 source Grep, 0 deno test).
- pm-file-reread: WATCHING, first seen 175521, last seen 181758. PM re-read
  SRS files (4× in 175521, 2× in 181758). Fix: ONE READ PER FILE (175521) +
  HARD STOP on SRS re-reads after Step 3 (181758).
- developer-batch-then-fix: NEW, first seen 20260314T181758. Developer wrote all
  4 scripts + 4 test files at once, deno task check failed, re-edited 6 test
  files across 15 extra turns. 43t/$2.19 vs target 35t. Fix: added incremental
  TDD algorithm (implement per-task, check after each).
- qa-duplicate-gh-commands: NEW, first seen 20260314T181758. QA ran `gh pr list`
  and `gh issue view 112` twice each. 23t/$0.78 vs target 15t. Fix: added
  explicit "ZERO duplicate Bash commands" rule.

## Resolved Patterns
- pm-tool-results-reread: RESOLVED (3+ clean runs)
- developer-grep-after-read: RESOLVED (3+ clean runs)
- qa-double-check: RESOLVED (3+ clean runs)
- tech-lead-write-rewrite: RESOLVED (3+ clean runs)
- developer-scope-creep: RESOLVED (2+ clean runs)
- pm-branch-shortcut-violation: RESOLVED (2 clean runs: 085155, 092842)
- pm-grep-after-read-v2: RESOLVED (pruned)
- qa-grep-after-read-v4: RESOLVED (pruned)
- qa-tool-results-path-typos: RESOLVED (pruned)
- developer-double-edit: RESOLVED (pruned)
- qa-bash-grep-v3: RESOLVED (3+ clean runs, 083240 branch)
- qa-double-deno-check: RESOLVED (083240 branch)
- qa-toolsearch: RESOLVED (3+ clean runs, 083240 branch)
- dev-toolsearch: RESOLVED (083240 branch)
- tl-toolsearch: RESOLVED (083240 branch)
- architect-git-archaeology: RESOLVED (3+ clean runs)

## Applied Fixes Log
- 20260313T021326–20260314T085155: (compressed — see git history for details)
- 20260314T092842: ALL 7 agents — resolved merge conflict markers in SKILL.md
  (root cause of persistent Skill self-invocation). developer + qa — added
  HARD STOP prohibition on reading `.claude/skills/` files (9+6 wasted Reads).
  PM prompt consolidated (removed duplicate execution algorithm, kept STEP 1-6).
  meta.md — resolved merge conflict between HEAD and origin/main branches.
- 20260314T172829: architect + tech-lead + developer — added scope-aware doc
  reading (read ONLY scope-relevant SRS/SDS based on spec frontmatter `scope:`
  field). developer — updated Grep-after-Read evidence with this run's data.
- 20260314T175521: pipeline.yaml — replaced hardcoded sdlc doc refs in
  architect/tech-lead/developer task_template with scope-aware instructions.
  PM — added scope-aware STEP 3 + ONE READ PER FILE hard stop (was reading
  requirements-engine.md 4×). QA — added HARD STOP on source code Grep (9
  calls), prohibited `deno test` separately, added to Bash forbidden list.
- 20260314T182039: developer — added pre-flight `git log` check to detect
  already-committed implementation before starting work. Added fresh evidence
  for ONE READ PER FILE rule (5 double-reads this run).
- 20260314T181758: developer — added incremental TDD algorithm (per-task
  implement+check loop) to prevent batch-then-fix pattern. pm — added HARD STOP
  on SRS re-reads after Step 3. qa — added ZERO duplicate Bash commands rule.
  Resolved merge conflicts in meta.md and agent-pm/SKILL.md from concurrent run.

## Lessons Learned
- Total pipeline cost baseline for S-effort issue: ~$2.50.
- Run artifacts under .sdlc/runs/ are gitignored — agents must use `git add -f`.
- QA self-approval fails (same user can't approve own PR). Need fallback path.
- **Blacklist approach fails for Bash commands.** WHITELIST is correct.
- **Rule placement matters.** HARD STOP before Responsibilities = strongest.
- **Cross-agent patterns:** Fix in one agent, apply to ALL.
- **Positive algorithms > prohibition.** Algorithm approach works better.
- **Cost trajectory:** $5.09→$2.31→$2.24→$2.76→$4.11→$2.50→$2.88→$4.46→$3.85→$5.29.
- **Scope-aware reads save ~25k tokens/agent.** Out-of-scope SRS/SDS docs add
  context that inflates cost per turn. Biggest impact on developer (most turns).
- **Scope enforcement needs explicit file path deny-lists.**
- **Merge conflicts in agent prompts are catastrophic.** They corrupt prompt
  structure — rules between conflict markers become unparseable.
- **requirements.md approaching 25k token limit.** May need to split SRS.
- **Pre-flight checks > prohibition.** Self-check steps work better than bans.
- **Positive alternatives with exact syntax.** Providing exact syntax eliminates
  gap between "don't use X" and knowing the alternative.
- **ToolSearch for built-in tools is a cross-agent anti-pattern.**
- **Background Bash is an anti-pattern for short commands.**
- **Pipeline YAML task_template overrides prompt rules.** Task templates must
  align with prompt scope-aware algorithms.
- **QA source-code Grep is exploratory waste.** QA verifies acceptance criteria,
  not code review. If `deno task check` passes, Grep on source adds no value.
- **Pre-flight `git log` saves entire runs.** When impl is pre-committed,
  developer wastes all turns rediscovering existing work.
- **Batch-all-then-fix is the anti-TDD.** When developer writes N files at once
  then runs check, failures compound across all files → N re-edits. Incremental
  (1 task → check → next) catches errors early in 1 file.
- **Concurrent pipeline runs cause merge conflicts in shared files.** meta.md
  and agent prompts edited by two meta-agent instances create git conflicts.
